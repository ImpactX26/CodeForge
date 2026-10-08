import hashlib
import json

CHAIN = []
GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def log(event: dict):
    prev = CHAIN[-1]["hash"] if CHAIN else GENESIS_HASH
    canonical_event = json.dumps(event, sort_keys=True)
    h = hashlib.sha256((prev + canonical_event).encode()).hexdigest()
    CHAIN.append({
        "event": event,
        "prev": prev,
        "hash": h
    })

def verify_chain() -> int:
    """Returns None if chain is intact, or index of first broken entry."""
    prev = GENESIS_HASH
    for i, entry in enumerate(CHAIN):
        if entry["prev"] != prev:
            return i
        canonical_event = json.dumps(entry["event"], sort_keys=True)
        h = hashlib.sha256((prev + canonical_event).encode()).hexdigest()
        if entry["hash"] != h:
            return i
        prev = entry["hash"]
    return None