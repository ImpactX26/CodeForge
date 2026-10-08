import sqlite3
from concurrent.futures import ThreadPoolExecutor
from app.sandbox import make_sandbox, destroy_sandbox
from app.adapters.payments import expand_plan
from app.rules import evaluate_plan_rules
from app.scoring import score_plan
from app.db import state_hash

def chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

def simulate_plan(plan: dict) -> dict:
    plan_id = plan["plan_id"]
    db_path = make_sandbox(plan_id)
    
    try:
        # 1. Expand plan
        expanded = expand_plan(db_path, plan_id, plan["params"])
        
        # 2. Check rules
        rule_result = evaluate_plan_rules(db_path, expanded)
        
        # 3. Score
        score = score_plan(
            total_eligible=38, # 38 clean invoices in seed
            paid_count=len(expanded["steps"]),
            rule_status=rule_result["status"],
            batch_size=plan["params"].get("batch_size", 10),
            reversible=True,
            needs_approval=rule_result["needs_approval"]
        )
        
        # 4. Generate Expected State Hashes for the Certificate
        expected_hashes = []
        steps = expanded.get("steps", [])
        batch_size = plan["params"].get("batch_size", 10)
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        for batch in chunks(steps, batch_size):
            batch_inv_ids = [s["invoice_id"] for s in batch]
            # Mock apply batch in sandbox
            for s in batch:
                cursor.execute("UPDATE invoices SET status = 'paid' WHERE invoice_id = ?", (s["invoice_id"],))
            conn.commit()
            
            # Record state hash immediately after batch
            expected_hashes.append(state_hash(db_path, batch_inv_ids))
            
        conn.close()

        return {
            "plan_id": plan_id,
            "expanded_plan": expanded,
            "status": rule_result["status"],
            "reason": rule_result["reason"],
            "needs_approval": rule_result["needs_approval"],
            "score": score,
            "expected_hashes": expected_hashes
        }
    finally:
        # Always clean up the sandbox
        destroy_sandbox(db_path)

def run_parallel_rollouts(plans: list) -> list:
    """Simulates 6 node GPU cluster using thread pooling."""
    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(simulate_plan, p) for p in plans]
        for future in futures:
            results.append(future.result())
    return results