import sqlite3

from app import audit
from app.db import state_hash
from app.security import approvals
from app.security.certificate import verify_certificate
from app.security.tokens import consume_token


def chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def execute_plan(plan: dict, cert: dict, token: str, live_db_path: str, gateway) -> str:
    """The ONLY code allowed to write to live.db after planning.

    Order matters: signature -> human approval -> single-use token, so that a
    missing approval never burns the token.
    """
    # 1. Cryptographic verification (signature, untampered plan, not expired)
    verify_certificate(cert, plan)

    # 2. Human approval gate
    if cert.get("needs_approval"):
        assert approvals.is_approved(cert["plan_hash"]), "HUMAN APPROVAL REQUIRED"

    # 3. Single-use token (replay protection)
    consume_token(token, cert["plan_hash"])

    steps = plan.get("steps", [])
    batch_size = max(1, int(plan.get("batch_size") or 10))
    expected = cert.get("expected", [])

    conn = sqlite3.connect(live_db_path, timeout=10)
    try:
        for i, batch in enumerate(chunks(steps, batch_size)):
            ids = [s["invoice_id"] for s in batch]

            hold = gateway.authorize(batch)  # money is only held, not moved

            # Drift check: does live look exactly like the sandbox did?
            live_hash = state_hash(live_db_path, ids)
            exp_hash = expected[i] if i < len(expected) else None
            if live_hash != exp_hash:
                gateway.void(hold["hold_id"])
                audit.log({"event": "DRIFT_DETECTED", "batch": i, "expected": exp_hash, "actual": live_hash})
                return "PAUSED_DRIFT_DETECTED"

            gateway.capture(hold["hold_id"])
            conn.executemany(
                "UPDATE invoices SET status = 'paid' WHERE invoice_id = ?",
                [(x,) for x in ids],
            )
            conn.commit()
            audit.log({"event": "BATCH_OK", "batch": i, "count": len(batch)})
    finally:
        conn.close()

    audit.log({"event": "EXECUTION_COMPLETE", "payments": len(steps)})
    return "DONE"