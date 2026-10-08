import secrets
import time

TOKENS = {}

def issue_token(plan_hash_str: str) -> str:
    token = secrets.token_hex(16)
    TOKENS[token] = {
        "ph": plan_hash_str,
        "used": False,
        "exp": time.time() + 60  # Valid for 60 seconds
    }
    return token

def consume_token(token: str, plan_hash_str: str):
    record = TOKENS.get(token)
    assert record is not None, "INVALID TOKEN"
    assert not record["used"], "TOKEN ALREADY USED (REPLAY ATTACK)"
    assert time.time() < record["exp"], "TOKEN EXPIRED"
    assert record["ph"] == plan_hash_str, "TOKEN BOUND TO DIFFERENT PLAN"
    record["used"] = True