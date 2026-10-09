import copy
import sqlite3
import threading
import time
import traceback
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import app.audit as audit
from app.db import DB_PATH, reset_db
from app.executor import execute_plan
from app.executors.naive import run_naive_pipeline
from app.gateway.mock_gateway import MockGateway
from app.planner import generate_plans
from app.reasoning import build_reasoning
from app.rollout import run_parallel_rollouts
from app.security.approvals import approve, request_approval
from app.security.certificate import issue_certificate
from app.security.tokens import issue_token

app = FastAPI(title="Dry-Run Agent Hackathon Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- shared state
EVENTS: list = []
STATE = {"epoch": 0}          # bumped on every reset / run; stale threads go silent
CURRENT_WINNER: dict = {}
GATEWAY = MockGateway()


class ResetRequest(BaseModel):
    num_invoices: int = 40


class RunRequest(BaseModel):
    command: str = "Clear pending invoices"


def make_emit(epoch: int):
    """Returns an emit() that silently drops events from outdated runs."""
    def emit(event: str, data: Optional[dict] = None):
        if epoch != STATE["epoch"]:
            return
        EVENTS.append({"event": event, "ts": int(time.time()), "data": data or {}})
    return emit


def err_text(e: Exception) -> str:
    return str(e) or type(e).__name__


@app.on_event("startup")
def startup():
    reset_db(40)


# --------------------------------------------------------------------- events
@app.get("/api/events")
def get_events(since: int = 0, epoch: int = -1):
    """Polling endpoint. If the client's epoch is stale it gets everything again."""
    stale = epoch != STATE["epoch"]
    snapshot = list(EVENTS)
    start = 0 if stale else since
    return {
        "events": snapshot[start:],
        "next_index": len(snapshot),
        "epoch": STATE["epoch"],
        "reset": stale,
    }


# ------------------------------------------------------------------ the agents
def run_naive_thread(epoch: int):
    emit = make_emit(epoch)
    try:
        run_naive_pipeline(DB_PATH, emit)
    except Exception as e:
        traceback.print_exc()
        emit("naive_error", {"error": err_text(e)})


def run_dryrun_thread(epoch: int):
    emit = make_emit(epoch)
    try:
        emit("dryrun_started")
        plans = generate_plans("Clear pending invoices")
        emit("plans_generated", {"plans": [
            {
                "plan_id": p["plan_id"],
                "strategy": p["strategy"],
                "pay_count": len(p["steps"]),
                "held_count": len(p["held"]),
                "batch_size": p["batch_size"],
            } for p in plans
        ]})

        results = run_parallel_rollouts(plans)

        passing = [r for r in results if r["status"] == "PASS"] or results
        winner = max(passing, key=lambda r: (r["score"], r.get("clean_paid", 0)))

        cert = issue_certificate(
            winner["expanded_plan"], winner["score"],
            winner["expected_hashes"], winner["needs_approval"],
        )
        token = issue_token(cert["plan_hash"])
        if cert["needs_approval"]:
            request_approval(cert["plan_hash"])

        if epoch != STATE["epoch"]:
            return  # a newer run replaced us while we were simulating

        CURRENT_WINNER.clear()
        CURRENT_WINNER.update({"plan": winner["expanded_plan"], "cert": cert, "token": token})

        # Only the winner needs to ship its full plan to the browser.
        slim = []
        for r in results:
            r2 = dict(r)
            if r["plan_id"] != winner["plan_id"]:
                r2.pop("expanded_plan", None)
            r2.pop("expected_hashes", None)
            if r["plan_id"] == winner["plan_id"]:
                r2["expected_hashes"] = r.get("expected_hashes", [])
            slim.append(r2)

        
    

        emit("comparison_ready", {
            "results": slim,
            "winner_id": winner["plan_id"],
            "cert": cert,
            "token": token,
            "reasoning": build_reasoning(results, winner["plan_id"]), # Pass the live AI dictionary to the frontend
        })
    except Exception as e:
        print("CRITICAL ERROR IN dry-run thread:")
        traceback.print_exc()
        emit("dryrun_error", {"error": err_text(e)})

# --- ORCHESTRATION PIPELINE ---
def run_sequential_pipeline(epoch: int):
    """Runs Naive first, pauses, then runs Dry-Run automatically."""
    run_naive_thread(epoch)
    
    if epoch != STATE["epoch"]:
        return
        
    # Dramatic pause so the user can register the catastrophic failure
    time.sleep(2.5)
    
    if epoch == STATE["epoch"]:
        run_dryrun_thread(epoch)


@app.post("/api/run")
def start_run(req: Optional[RunRequest] = None):
    STATE["epoch"] += 1
    epoch = STATE["epoch"]
    EVENTS.clear()
    CURRENT_WINNER.clear()
    # Spawn a single sequential orchestrator thread
    threading.Thread(target=run_sequential_pipeline, args=(epoch,), daemon=True).start()
    return {"status": "started", "epoch": epoch}


# ------------------------------------------------------------ safety-gate API
@app.post("/api/approve")
def approve_plan():
    if not CURRENT_WINNER:
        raise HTTPException(status_code=400, detail="No active plan")
    approve(CURRENT_WINNER["cert"]["plan_hash"])
    EVENTS.append({"event": "approved", "ts": int(time.time()), "data": {}})
    return {"status": "approved"}


@app.post("/api/execute")
def execute():
    if not CURRENT_WINNER:
        raise HTTPException(status_code=400, detail="No active plan")
    try:
        res = execute_plan(
            CURRENT_WINNER["plan"], CURRENT_WINNER["cert"],
            CURRENT_WINNER["token"], DB_PATH, GATEWAY,
        )
        EVENTS.append({
            "event": "execution_result", "ts": int(time.time()),
            "data": {"status": res, "payments": len(CURRENT_WINNER["plan"].get("steps", []))},
        })
        return {"status": res}
    except Exception as e:
        EVENTS.append({"event": "execution_failed", "ts": int(time.time()), "data": {"error": err_text(e)}})
        raise HTTPException(status_code=400, detail=err_text(e))


@app.post("/api/tamper")
def tamper_test():
    if not CURRENT_WINNER:
        raise HTTPException(status_code=400, detail="No active plan")

    tampered = copy.deepcopy(CURRENT_WINNER["plan"])
    if tampered.get("steps"):
        tampered["steps"][0]["account"] = "9999999999"
    else:
        tampered["strategy"] = tampered.get("strategy", "") + " (edited)"

    try:
        execute_plan(tampered, CURRENT_WINNER["cert"], CURRENT_WINNER["token"], DB_PATH, GATEWAY)
        EVENTS.append({"event": "tamper_blocked", "ts": int(time.time()),
                       "data": {"error": "UNEXPECTED: tampered plan was accepted"}})
        return {"status": "accepted"}
    except Exception as e:
        EVENTS.append({"event": "tamper_blocked", "ts": int(time.time()), "data": {"error": err_text(e)}})
        return {"status": "blocked", "error": err_text(e)}


@app.post("/api/chaos")
def inject_drift():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    try:
        target = None
        if CURRENT_WINNER and CURRENT_WINNER["plan"].get("steps"):
            target = CURRENT_WINNER["plan"]["steps"][-1]["invoice_id"]
        else:
            row = conn.execute(
                "SELECT invoice_id FROM invoices WHERE status = 'pending' ORDER BY invoice_id DESC LIMIT 1"
            ).fetchone()
            target = row[0] if row else None
        if not target:
            raise HTTPException(status_code=400, detail="Nothing to drift")
        conn.execute("UPDATE invoices SET status = 'paid' WHERE invoice_id = ?", (target,))
        conn.commit()
    finally:
        conn.close()
    EVENTS.append({"event": "drift_injected", "ts": int(time.time()), "data": {"invoice_id": target}})
    return {"status": "drift_injected", "invoice_id": target}


@app.post("/api/reset")
def reset_demo(req: Optional[ResetRequest] = None):
    n = max(3, min(500, req.num_invoices if req else 40))
    STATE["epoch"] += 1
    reset_db(n)
    EVENTS.clear()
    audit.CHAIN.clear()
    CURRENT_WINNER.clear()
    return {"status": "reset_ok", "invoices_generated": n, "epoch": STATE["epoch"]}