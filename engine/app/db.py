import hashlib
import os
import random
import sqlite3

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DATA_DIR, "live.db")


def get_connection():
    os.makedirs(DATA_DIR, exist_ok=True)
    return sqlite3.connect(DB_PATH, timeout=10)


def init_db(num_invoices: int = 40):
    """Creates the tables and fills them with freshly generated invoices.

    Every run is different, but there is ALWAYS at least one duplicate
    invoice (INV-1001) and one recently-changed-bank invoice (INV-1002),
    plus roughly 4% extra random faults of each kind.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            invoice_id TEXT PRIMARY KEY,
            vendor_id TEXT,
            amount INTEGER,
            account TEXT,
            ifsc TEXT,
            status TEXT,
            bank_changed_days_ago INTEGER
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gateway_transactions (
            idem_key TEXT PRIMARY KEY,
            invoice_id TEXT,
            amount INTEGER,
            status TEXT
        )
    """)

    rows = []
    for i in range(num_invoices):
        inv_id = f"INV-{1000 + i}"

        if i > 0 and (i == 1 or random.random() < 0.04):
            # DUPLICATE: same vendor / amount / account as an earlier invoice
            src = rows[random.randrange(0, i)]
            rows.append((inv_id, src[1], src[2], src[3], src[4], "duplicate", 0))
        elif i == 2 or random.random() < 0.04:
            # FRAUD PATTERN: vendor changed bank details a few days ago
            vendor_no = random.randint(1, 99)
            rows.append((
                inv_id, f"V{vendor_no:02d}", random.randint(10000, 999999),
                f"9{random.randint(100000000, 999999999)}", "ICIC0009999",
                "pending", random.randint(1, 5),
            ))
        else:
            vendor_no = random.randint(1, 99)
            rows.append((
                inv_id, f"V{vendor_no:02d}", random.randint(10000, 999999),
                f"50100{vendor_no:07d}", "HDFC0001234", "pending", 0,
            ))

    cur.executemany("INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?, ?)", rows)
    conn.commit()
    conn.close()


def state_hash(db_path: str, batch_invoices: list) -> str:
    """SHA-256 fingerprint of status + account for a batch of invoices."""
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    hasher = hashlib.sha256()
    for inv_id in sorted(batch_invoices):
        cur.execute(
            "SELECT invoice_id, status, account FROM invoices WHERE invoice_id = ?",
            (inv_id,),
        )
        row = cur.fetchone()
        if row:
            hasher.update(f"{row['invoice_id']}:{row['status']}:{row['account']}".encode())

    conn.close()
    return hasher.hexdigest()


def reset_db(num_invoices: int = 40):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS invoices")
    cur.execute("DROP TABLE IF EXISTS gateway_transactions")
    conn.commit()
    conn.close()
    init_db(num_invoices)