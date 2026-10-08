import sqlite3
import time

def run_naive_pipeline(db_path: str, events: list):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM invoices WHERE status != 'paid'")
    invoices = cursor.fetchall()
    
    damage = 0
    for inv in invoices:
        # Blindly pay everything
        cursor.execute("UPDATE invoices SET status = 'paid' WHERE invoice_id = ?", (inv["invoice_id"],))
        
        # Calculate real damage for the demo dashboard
        if inv["status"] == "duplicate" or inv["bank_changed_days_ago"] > 0:
            damage += inv["amount"]
            
        events.append({
            "event": "naive_step", 
            "ts": int(time.time()), 
            "data": {"invoice_id": inv["invoice_id"], "amount": inv["amount"], "damage_so_far": damage}
        })
        time.sleep(0.1) # small delay for visual effect
        
    conn.commit()
    conn.close()
    
    events.append({
        "event": "naive_done", 
        "ts": int(time.time()), 
        "data": {"total_damage": damage, "error": "Paid duplicates and fraudulent accounts."}
    })