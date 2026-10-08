from app.config import DAILY_SPEND_LIMIT, APPROVAL_THRESHOLD
import sqlite3

def evaluate_plan_rules(db_path: str, expanded_plan: dict) -> dict:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    total_amount = sum(step["amount"] for step in expanded_plan.get("steps", []))
    needs_approval = total_amount > APPROVAL_THRESHOLD or len(expanded_plan.get("held", [])) > 0
    
    # Rule: Daily limit
    if total_amount > DAILY_SPEND_LIMIT:
        conn.close()
        return {"status": "FAIL", "reason": f"Exceeds daily limit (Total: {total_amount})", "needs_approval": needs_approval}

    # Rules: Veto on duplicates or fraud accounts
    for step in expanded_plan.get("steps", []):
        cursor.execute("SELECT status, bank_changed_days_ago FROM invoices WHERE invoice_id = ?", (step["invoice_id"],))
        row = cursor.fetchone()
        if row:
            if row["status"] == "duplicate":
                conn.close()
                return {"status": "VETO", "reason": f"Attempted to pay duplicate invoice {step['invoice_id']}", "needs_approval": needs_approval}
            if 0 < row["bank_changed_days_ago"] <= 7:
                conn.close()
                return {"status": "VETO", "reason": f"Attempted to pay recently changed bank account {step['invoice_id']}", "needs_approval": needs_approval}
    
    conn.close()
    return {"status": "PASS", "reason": "All safety checks passed", "needs_approval": needs_approval}