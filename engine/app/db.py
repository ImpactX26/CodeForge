import sqlite3
import hashlib
import os

DB_PATH = "data/live.db"

def get_connection():
    os.makedirs("data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invoices (
        invoice_id TEXT PRIMARY KEY,
        vendor_id TEXT,
        amount REAL,
        account TEXT,
        ifsc TEXT,
        due_date TEXT,
        status TEXT, -- 'pending', 'paid', 'held', 'duplicate'
        bank_changed_days_ago INTEGER DEFAULT 0
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gateway_transactions (
        idem_key TEXT PRIMARY KEY,
        invoice_id TEXT,
        amount REAL,
        status TEXT -- 'authorized', 'captured', 'voided'
    )
    """)
    
    # Seed Data (38 clean, 1 duplicate, 1 changed bank)
    cursor.execute("SELECT COUNT(*) FROM invoices")
    if cursor.fetchone()[0] == 0:
        invoices = []
        # 38 clean invoices (~1L each)
        for i in range(1, 39):
            invoices.append((f"INV-{1000+i}", f"V{i:02d}", 100000.0, f"50100{i:06d}", "HDFC0001234", "2026-10-10", "pending", 0))
        
        # 1 Duplicate invoice (Rs 4,50,000)
        invoices.append(("INV-1039", "V05", 450000.0, "5010005050", "HDFC0001234", "2026-10-09", "duplicate", 0))
        
        # 1 Changed-bank vendor fraud pattern (Rs 7,50,000)
        invoices.append(("INV-1040", "V12", 750000.0, "9999999999", "ICIC0009999", "2026-10-08", "pending", 2))
        
        cursor.executemany("INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?, ?, ?)", invoices)
        conn.commit()
    
    conn.close()

def state_hash(db_path: str, batch_invoices: list) -> str:
    """Computes a SHA-256 fingerprint of the invoice statuses & accounts for a given batch."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    hasher = hashlib.sha256()
    for inv_id in sorted(batch_invoices):
        cursor.execute("SELECT invoice_id, status, account FROM invoices WHERE invoice_id = ?", (inv_id,))
        row = cursor.fetchone()
        if row:
            hasher.update(f"{row['invoice_id']}:{row['status']}:{row['account']}".encode())
            
    conn.close()
    return hasher.hexdigest()