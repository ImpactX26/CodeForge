import base64
import hashlib
import json
import time

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

# Keypair lives in memory only: restarting the server invalidates old certificates.
PRIVATE_KEY = Ed25519PrivateKey.generate()
PUBLIC_KEY = PRIVATE_KEY.public_key()

# Demo-friendly lifetime. Set to 60 if you want the strict "60-second" pitch.
CERT_TTL_SECONDS = 180


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
        "expires_at": time.time() + CERT_TTL_SECONDS,
    }
    signature = base64.b64encode(PRIVATE_KEY.sign(canonical_json(body))).decode()
    return {**body, "signature": signature}


def verify_certificate(cert: dict, plan: dict):
    body = {k: v for k, v in cert.items() if k != "signature"}
    sig = base64.b64decode(cert["signature"])

    # 1. Ed25519 signature must match the certificate body
    PUBLIC_KEY.verify(sig, canonical_json(body))
    # 2. The plan being executed must be byte-for-byte the plan that was signed
    assert plan_hash(plan) == cert["plan_hash"], "PLAN CHANGED AFTER APPROVAL"
    # 3. Certificate must still be fresh
    assert time.time() < cert["expires_at"], "CERTIFICATE EXPIRED"