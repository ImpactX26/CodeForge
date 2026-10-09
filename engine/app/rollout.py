import sqlite3
import traceback
from concurrent.futures import ThreadPoolExecutor

from app.sandbox import make_sandbox, destroy_sandbox
from app.rules import evaluate_plan_rules
from app.scoring import score_plan
from app.db import state_hash


def chunks(lst, n):
    """Yield successive n-sized chunks of lst (does nothing if n <= 0)."""
    if n <= 0:
        return
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def simulate_plan(plan: dict) -> dict:
    """Runs ONE plan inside its own cloned sandbox database."""
    plan_id = plan.get("plan_id", "?")
    db_path = None
    try:
        db_path = make_sandbox(plan_id)
        steps = plan.get("steps", [])
        batch_size = plan.get("batch_size", 10)

        rule = evaluate_plan_rules(db_path, plan)

        conn = sqlite3.connect(db_path, timeout=10)
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM invoices "
            "WHERE status NOT IN ('duplicate', 'paid') AND bank_changed_days_ago = 0"
        )
        total_eligible = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM invoices WHERE status = 'duplicate'")
        total_dup = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM invoices WHERE status != 'duplicate' AND bank_changed_days_ago > 0"
        )
        total_fraud = cur.fetchone()[0]

        clean_paid = max(0, len(steps) - rule["dup_count"] - rule["fraud_count"])

        score = score_plan(
            total_eligible=max(1, total_eligible),
            paid_count=clean_paid,
            rule_status=rule["status"],
            batch_size=batch_size,
            reversible=True,
            needs_approval=rule["needs_approval"],
            violations=rule["violations"],
            total_steps=len(steps),
        )

        # "Expected state fingerprints": hash of each batch as it looks BEFORE
        # it is applied. The executor re-computes the same hash on the live DB
        # right before each batch; if it differs, the world drifted.
        expected_hashes = []
        if rule["status"] == "PASS" and batch_size > 0:
            for batch in chunks(steps, batch_size):
                ids = [s["invoice_id"] for s in batch]
                expected_hashes.append(state_hash(db_path, ids))
                cur.executemany(
                    "UPDATE invoices SET status = 'paid' WHERE invoice_id = ?",
                    [(i,) for i in ids],
                )
                conn.commit()
        conn.close()

        return {
            "plan_id": plan_id,
            "strategy": plan.get("strategy", ""),
            "expanded_plan": plan,
            "status": rule["status"],
            "reason": rule["reason"],
            "needs_approval": rule["needs_approval"],
            "score": score,
            "expected_hashes": expected_hashes,
            # facts used by the UI and the reasoning generator
            "pay_count": len(steps),
            "held_count": len(plan.get("held", [])),
            "clean_paid": clean_paid,
            "total_eligible": total_eligible,
            "total_dup": total_dup,
            "total_fraud": total_fraud,
            "dup_count": rule["dup_count"],
            "fraud_count": rule["fraud_count"],
            "dup_amount": rule["dup_amount"],
            "fraud_amount": rule["fraud_amount"],
            "total_amount": rule["total_amount"],
            "batch_size": batch_size,
            "success_pct": round(100 * clean_paid / max(1, total_eligible), 1),
        }
    except Exception as e:  # never let one plan freeze the whole UI
        print(f"CRASH IN PLAN {plan_id}: {e}")
        traceback.print_exc()
        return {
            "plan_id": plan_id,
            "strategy": plan.get("strategy", ""),
            "expanded_plan": plan,
            "status": "FAIL",
            "reason": f"Simulation error: {e}",
            "needs_approval": False,
            "score": 0,
            "expected_hashes": [],
            "pay_count": len(plan.get("steps", [])),
            "held_count": len(plan.get("held", [])),
            "clean_paid": 0, "total_eligible": 0, "total_dup": 0, "total_fraud": 0,
            "dup_count": 0, "fraud_count": 0, "dup_amount": 0, "fraud_amount": 0,
            "total_amount": 0, "batch_size": plan.get("batch_size", 0), "success_pct": 0,
        }
    finally:
        destroy_sandbox(db_path)


def run_parallel_rollouts(plans: list) -> list:
    """Simulated 6-node cluster: one worker thread per plan."""
    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(simulate_plan, plans))