import sqlite3

def expand_plan(db_path: str, plan_id: str, params: dict) -> dict:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Sort order logic based on params
    order_clause = "ORDER BY due_date ASC" if params.get("order") == "due_date" else ""
    cursor.execute(f"SELECT * FROM invoices WHERE status != 'paid' {order_clause}")
    invoices = cursor.fetchall()
    
    steps = []
    held = []
    
    for inv in invoices:
        # Check max payment param
        if inv["amount"] > params.get("max_per_payment", float('inf')):
            continue
        
        # Check duplicate instruction
        if params.get("skip_duplicates", False) and inv["status"] == "duplicate":
            continue
            
        # Check bank details hold instruction
        if params.get("hold_bank_changed", False) and inv["bank_changed_days_ago"] > 0 and inv["bank_changed_days_ago"] <= 7:
            held.append({"invoice_id": inv["invoice_id"], "reason": "bank details changed recently"})
            continue
            
        steps.append({
            "invoice_id": inv["invoice_id"],
            "vendor_id": inv["vendor_id"],
            "amount": inv["amount"],
            "account": inv["account"],
            "ifsc": inv["ifsc"],
            "idem_key": f"{inv['invoice_id']}-pay"
        })
        
    conn.close()
    
    return {
        "plan_id": plan_id,
        "steps": steps,
        "held": held
    }