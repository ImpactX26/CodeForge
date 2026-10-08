import shutil
import os

def make_sandbox(plan_id: str) -> str:
    """Clones live.db to an isolated sandbox file in milliseconds."""
    os.makedirs("data", exist_ok=True)
    path = f"data/sandbox_{plan_id}.db"
    if os.path.exists(path):
        os.remove(path)
    shutil.copy("data/live.db", path)
    return path

def destroy_sandbox(path: str):
    """Destroys the sandbox file after simulation."""
    if os.path.exists(path):
        os.remove(path)