import os
import sqlite3
import uuid

from app.db import DATA_DIR, DB_PATH


def make_sandbox(plan_id: str, source: str = DB_PATH) -> str:
    """Clones the live database into a private, uniquely named sandbox file.

    Uses SQLite's backup API, so the copy is always consistent, and a unique
    suffix so two runs can never fight over the same sandbox file.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, f"sandbox_{plan_id}_{uuid.uuid4().hex[:6]}.db")

    src = sqlite3.connect(source, timeout=10)
    dst = sqlite3.connect(path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    return path


def destroy_sandbox(path: str):
    """Deletes a sandbox file (never raises)."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError:
        pass