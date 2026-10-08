APPROVALS = {}

def request_approval(plan_hash: str):
    APPROVALS[plan_hash] = False

def approve(plan_hash: str):
    APPROVALS[plan_hash] = True

def reject(plan_hash: str):
    if plan_hash in APPROVALS:
        del APPROVALS[plan_hash]

def is_approved(plan_hash: str) -> bool:
    return APPROVALS.get(plan_hash, False)