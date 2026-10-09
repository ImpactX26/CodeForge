import os
import json
from google import genai
from google.genai import types

# Initialize the Gemini client. It will automatically look for the GEMINI_API_KEY environment variable.
try:
    client = genai.Client()
except Exception as e:
    print(f"Warning: Failed to initialize Gemini client. {e}")
    client = None

def _rs(n) -> str:
    return f"Rs {int(n):,}"

def _explain(r: dict, w: dict, is_winner: bool) -> str:
    """Deterministic fallback explanation if the LLM API fails or times out."""
    pid = r["plan_id"]

    if r["status"] == "VETO":
        bits = []
        if r.get("dup_count"):
            bits.append(f"{r['dup_count']} duplicate invoice(s) ({_rs(r['dup_amount'])})")
        if r.get("fraud_count"):
            bits.append(f"{r['fraud_count']} payment(s) to recently changed bank accounts ({_rs(r['fraud_amount'])})")
        return (f"REJECTED: Plan {pid} would have paid " + " and ".join(bits) +
                f". The safety rules vetoed it inside the sandbox, so it scored only {r['score']}/100.")

    if r["status"] == "FAIL":
        return f"REJECTED: {r.get('reason', 'Unknown failure')}. Score {r['score']}/100."

    if is_winner:
        return (f"SELECTED WINNER: Top score of {r['score']}/100. It paid {r.get('clean_paid', 0)} of "
                f"{r.get('total_eligible', 0)} clean invoices ({_rs(r.get('total_amount', 0))}), skipped "
                f"{r.get('total_dup', 0)} duplicate(s), held {r.get('total_fraud', 0)} bank-changed invoice(s) for "
                f"human review, and used batches of {r.get('batch_size', 0)} to keep the blast radius small.")

    reasons = []
    if r.get("pay_count", 0) == 0:
        reasons.append("it made no payments, so the job was not done")
    else:
        if r.get("success_pct", 100) < 100:
            reasons.append(f"it completed only {r['success_pct']}% of the eligible invoices")
        if r.get("batch_size", 0) > 10:
            reasons.append(f"it ran {r['pay_count']} payments as one big batch, which is a large blast radius")
    if r.get("needs_approval") and not w.get("needs_approval"):
        reasons.append("it needs extra human approval")
    if not reasons:
        reasons.append("it lost on tie-breakers")
    gap = w["score"] - r["score"]
    return (f"SUB-OPTIMAL: passed every rule, but Plan {w['plan_id']} beat it by {gap} points because "
            + "; ".join(reasons) + ".")

def build_reasoning(results: list, winner_id: str) -> dict:
    by_id = {r["plan_id"]: r for r in results}
    w = by_id[winner_id]
    ranked = sorted(results, key=lambda r: r["score"], reverse=True)
    runner = next((r for r in ranked if r["plan_id"] != winner_id and r["status"] == "PASS"), None)
    vetoed = [r["plan_id"] for r in results if r["status"] in ("VETO", "FAIL")]

    # Deterministic Summary and Checks (kept for full ResultView support)
    summary = (
        f"Plan {winner_id} won with {w['score']}/100 out of {len(results)} simulated futures. "
        f"It pays {w.get('clean_paid', 0)} of {w.get('total_eligible', 0)} clean invoices ({_rs(w.get('total_amount', 0))}), "
        f"skips {w.get('total_dup', 0)} duplicate(s) and holds {w.get('total_fraud', 0)} bank-changed invoice(s), "
        f"so the money lost on production is Rs 0."
    )
    if vetoed:
        summary += f" Plans {', '.join(vetoed)} were rejected by the safety rules."
    if runner:
        summary += (f" The runner-up, Plan {runner['plan_id']} ({runner['score']}/100), "
                    f"was safe but lost points on completeness or blast radius.")

    checks = [
        f"0 duplicate payments ({w.get('total_dup', 0)} skipped)",
        f"0 payments to recently changed bank accounts ({w.get('total_fraud', 0)} held for review)",
        f"{w.get('clean_paid', 0)}/{w.get('total_eligible', 0)} clean invoices covered ({w.get('success_pct', 0)}%)",
        f"Largest batch is {w.get('batch_size', 0)} payments, so any failure stays small",
        "Every batch is protected by a gateway hold that can be voided",
        "Plan is locked with an Ed25519 signature before it may touch production",
    ]

    # Live LLM Reasoning Generation for Hover States
    per_plan_reasoning = {}
    if client:
        prompt = f"""
        You are an AI safety auditor. I ran 6 execution plans in an isolated sandbox. 
        Here are the raw results of those simulations: {json.dumps(results)}
        The winning plan chosen by the deterministic math was Plan {winner_id}.
        
        Write a 1-sentence explanation for EACH plan explaining why it was 
        selected or rejected based on its score, status, completeness, and blast radius.
        Format your response as a strict JSON dictionary where keys are the plan IDs ("A", "B", etc.), 
        and values are the 1-sentence string. Start rejected plans with 'REJECTED:' or 'SUB-OPTIMAL:', 
        and the winner with 'SELECTED WINNER:'.
        """
        
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2, # Keep hallucination risk low
                ),
            )
            per_plan_reasoning = json.loads(response.text)
        except Exception as e:
            print(f"LLM API Failed, falling back to deterministic explanation: {e}")
    
    # If the LLM failed, or the API key was missing, fall back to the python logic
    if not per_plan_reasoning:
        per_plan_reasoning = {r["plan_id"]: _explain(r, w, r["plan_id"] == winner_id) for r in results}

    return {
        "summary": summary,
        "checks": checks,
        "per_plan": per_plan_reasoning,
        "ranking": [{"plan_id": r["plan_id"], "score": r["score"]} for r in ranked],
    }

def build_naive_explanation(dups: int, dup_amt: int, frauds: int, fraud_amt: int, paid: int) -> str:
    return (
        f"The naive agent paid all {paid} invoices in one pass without checking anything. "
        f"That included {dups} duplicate invoice(s) ({_rs(dup_amt)}) and {frauds} payment(s) to "
        f"vendors whose bank details had just changed ({_rs(fraud_amt)}). "
        f"It had no sandbox to try the plan first, so it only discovered the damage after the money was gone."
    )