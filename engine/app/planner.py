from app.db import get_connection


def generate_plans(command: str) -> list:
    """Builds the 6 candidate plans from the CURRENT contents of live.db.

    Every step carries everything the rules engine, gateway and executor
    need (amount, account, ifsc, idem_key) so nothing downstream can hit a
    KeyError. `batch_size` is what differentiates the blast radius of plans.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT invoice_id, vendor_id, amount, account, ifsc, status, bank_changed_days_ago "
        "FROM invoices WHERE status != 'paid' ORDER BY invoice_id"
    )
    invoices = cur.fetchall()
    conn.close()

    def step(inv):
        return {
            "action": "pay",
            "invoice_id": inv[0],
            "vendor_id": inv[1],
            "amount": inv[2],
            "account": inv[3],
            "ifsc": inv[4],
            "idem_key": f"{inv[0]}-pay",
        }

    duplicates = [i for i in invoices if i[5] == "duplicate"]
    risky_bank = [i for i in invoices if i[5] != "duplicate" and i[6] > 0]
    clean = [i for i in invoices if i[5] != "duplicate" and i[6] == 0]
    non_duplicates = [i for i in invoices if i[5] != "duplicate"]
    high_value = [i for i in clean if i[2] > 500000]

    def held(rows, reason):
        return [{"invoice_id": i[0], "reason": reason} for i in rows]

    return [
        {
            "plan_id": "A",
            "strategy": "Pay everything immediately (Blind Aggressive)",
            "steps": [step(i) for i in invoices],
            "held": [],
            "batch_size": 1000,
        },
        {
            "plan_id": "B",
            "strategy": "Pay all except duplicates (Deduplicated Only)",
            "steps": [step(i) for i in non_duplicates],
            "held": [],
            "batch_size": 1000,
        },
        {
            "plan_id": "C",
            "strategy": "Skip duplicates, hold bank changes, batches of 10 (Staged & Verified)",
            "steps": [step(i) for i in clean],
            "held": held(risky_bank, "Bank details changed recently"),
            "batch_size": 10,
        },
        {
            "plan_id": "D",
            "strategy": "Same as C but in one massive batch (Monolithic Batch)",
            "steps": [step(i) for i in clean],
            "held": held(risky_bank, "Bank details changed recently"),
            "batch_size": 1000,
        },
        {
            "plan_id": "E",
            "strategy": "Pay only high-value clean invoices (Partial job)",
            "steps": [step(i) for i in high_value],
            "held": [],
            "batch_size": 5,
        },
        {
            "plan_id": "F",
            "strategy": "Halt and escalate everything (Complete Halt)",
            "steps": [],
            "held": held(invoices, "Escalated for manual review"),
            "batch_size": 0,
        },
    ]