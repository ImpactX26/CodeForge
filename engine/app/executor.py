import sqlite3
from app.db import state_hash
from app.security.certificate import verify_certificate
from app.security.tokens import consume_token
from app.security import approvals
from app import audit

def chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

def execute_plan(plan: dict, cert: dict, token: str, live_db_path: str, gateway) -> str:
    # 1. Cryptographic Verification
    verify_certificate(cert, plan)
    
    # 2. Token Consumption (Replay protection)
    consume_token(token, cert["plan_hash"])
    
    # 3. Human Approval Gate if total > threshold
    if cert["needs_approval"]:
        assert approvals.is_approved(cert["plan_hash"]), "HUMAN APPROVAL REQUIRED"
        
    conn = sqlite3.connect(live_db_path)
    cursor = conn.cursor()
    
    steps = plan.get("steps", [])
    batch_invoices = [s["invoice_id"] for s in steps]
    
    for i, batch_steps in enumerate(chunks(steps, 10)):
        invoice_ids_in_batch = [s["invoice_id"] for s in batch_steps]
        
        # Authorize funds on gateway (hold)
        hold_res = gateway.authorize(batch_steps)
        
        # Drift Check: Compare live DB state hash with expected sandbox state hash
        current_live_hash = state_hash(live_db_path, invoice_ids_in_batch)
        expected_hash = cert["expected"][i] if i < len(cert["expected"]) else None
        
        if current_live_hash != expected_hash:
            gateway.void(hold_res["hold_id"])
            audit.log({"event": "DRIFT_DETECTED", "batch": i, "expected": expected_hash, "actual": current_live_hash})
            conn.close()
            return "PAUSED_DRIFT_DETECTED"
            
        # Capture hold if no drift
        gateway.capture(hold_res["hold_id"])
        
        for s in batch_steps:
            cursor.execute("UPDATE invoices SET status = 'paid' WHERE invoice_id = ?", (s["invoice_id"],))
        conn.commit()
        
        audit.log({"event": "BATCH_OK", "batch": i, "count": len(batch_steps)})
        
    conn.close()
    return "DONE"
