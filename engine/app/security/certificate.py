import json
import hashlib
import base64
import time
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

# In-memory private/public keypair generated at startup
PRIVATE_KEY = Ed25519PrivateKey.generate()
PUBLIC_KEY = PRIVATE_KEY.public_key()

def canonical_json(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()

def plan_hash(plan: dict) -> str:
    return hashlib.sha256(canonical_json(plan)).hexdigest()

def issue_certificate(plan: dict, score: float, expected: list, needs_approval: bool) -> dict:
    body = {
        "plan_hash": plan_hash(plan),
        "score": score,
        "expected": expected,
        "needs_approval": needs_approval,
        "expires_at": time.time() + 120
    }
    signature = base64.b64encode(PRIVATE_KEY.sign(canonical_json(body))).decode()
    return {**body, "signature": signature}

def verify_certificate(cert: dict, plan: dict):
    body = {k: v for k, v in cert.items() if k != "signature"}
    sig = base64.b64decode(cert["signature"])
    
    # 1. Verify Ed25519 cryptographic signature
    PUBLIC_KEY.verify(sig, canonical_json(body))
    
    # 2. Verify plan has not been tampered with
    assert plan_hash(plan) == cert["plan_hash"], "PLAN CHANGED AFTER APPROVAL"
    
    # 3. Check expiration
    assert time.time() < cert["expires_at"], "CERTIFICATE EXPIRED"