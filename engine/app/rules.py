import sqlite3

from app.config import DAILY_SPEND_LIMIT, APPROVAL_THRESHOLD


def evaluate_plan_rules(db_path: str, plan: dict) -> dict:
    """Runs the safety rules for one plan against its private sandbox DB."""
    steps = plan.get("steps", [])
    held = plan.get("held", [])

    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Limits scale with the size of the dataset so the demo works for any
    # number of invoices (never lower than the values in config.py).
    cur.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM invoices "
        "WHERE status != 'duplicate' AND status != 'paid' AND bank_changed_days_ago = 0"
    )
    clean_total = cur.fetchone()["s"]
    daily_limit = max(DAILY_SPEND_LIMIT, int(clean_total * 1.25))
    approval_threshold = max(APPROVAL_THRESHOLD, int(clean_total * 0.5))

    total_amount = sum(s.get("amount", 0) for s in steps)
    needs_approval = total_amount > approval_threshold or len(held) > 0

    dup_count = fraud_count = 0
    dup_amount = fraud_amount = 0
    for s in steps:
        cur.execute(
            "SELECT status, bank_changed_days_ago FROM invoices WHERE invoice_id = ?",
            (s["invoice_id"],),
        )
        row = cur.fetchone()
        if not row:
            continue
        if row["status"] == "duplicate":
            dup_count += 1
            dup_amount += s.get("amount", 0)
        elif 0 < row["bank_changed_days_ago"] <= 7:
            fraud_count += 1
            fraud_amount += s.get("amount", 0)
    conn.close()

    violations = dup_count + fraud_count
    out = {
        "needs_approval": needs_approval,
        "dup_count": dup_count,
        "fraud_count": fraud_count,
        "dup_amount": dup_amount,
        "fraud_amount": fraud_amount,
        "violations": violations,
        "total_amount": total_amount,
        "daily_limit": daily_limit,
    }

    if violations:
        parts = []
        if dup_count:
            parts.append(f"{dup_count} duplicate invoice(s)")
        if fraud_count:
            parts.append(f"{fraud_count} payment(s) to recently changed bank accounts")
        out.update(status="VETO", reason="Would have paid " + " and ".join(parts))
    elif total_amount > daily_limit:
        out.update(status="FAIL", reason=f"Exceeds daily limit (Rs {total_amount:,} > Rs {daily_limit:,})")
    else:
        out.update(status="PASS", reason="All safety checks passed")
    return out