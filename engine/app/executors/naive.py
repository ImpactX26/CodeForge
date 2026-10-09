import sqlite3
import time

from app.sandbox import make_sandbox, destroy_sandbox
from app.reasoning import build_naive_explanation


def run_naive_pipeline(db_path: str, emit):
    """The unguarded agent: pays every invoice with zero checks.

    It runs on its OWN private copy of the data, so it can never disturb the
    live.db that the Dry-Run agent is planning against (the two agents run
    side by side in the split-screen demo).
    """
    path = make_sandbox("naive")
    conn = None
    try:
        conn = sqlite3.connect(path, timeout=10)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM invoices WHERE status != 'paid' ORDER BY invoice_id"
        ).fetchall()
        total = len(rows)
        emit("naive_started", {"total": total})

        delay = max(0.01, min(0.12, 5.0 / max(1, total)))
        damage = dups = frauds = dup_amt = fraud_amt = 0

        for idx, inv in enumerate(rows, 1):
            flag = None
            if inv["status"] == "duplicate":
                flag = "duplicate"
                dups += 1
                dup_amt += inv["amount"]
                damage += inv["amount"]
            elif inv["bank_changed_days_ago"] > 0:
                flag = "bank_changed"
                frauds += 1
                fraud_amt += inv["amount"]
                damage += inv["amount"]

            conn.execute("UPDATE invoices SET status = 'paid' WHERE invoice_id = ?", (inv["invoice_id"],))
            emit("naive_step", {
                "invoice_id": inv["invoice_id"],
                "amount": inv["amount"],
                "flag": flag,
                "index": idx,
                "total": total,
                "damage_so_far": damage,
            })
            time.sleep(delay)

        conn.commit()
        emit("naive_done", {
            "total_damage": damage,
            "paid": total,
            "duplicates": dups,
            "bank_changed": frauds,
            "duplicate_amount": dup_amt,
            "bank_changed_amount": fraud_amt,
            "explanation": build_naive_explanation(dups, dup_amt, frauds, fraud_amt, total),
        })
    finally:
        if conn:
            conn.close()
        destroy_sandbox(path)