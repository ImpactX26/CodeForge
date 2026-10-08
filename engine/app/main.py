import time
import sqlite3
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.db import init_db, DB_PATH
from app.planner import generate_plans
from app.rollout import run_parallel_rollouts
from app.security.certificate import issue_certificate
from app.security.tokens import issue_token
from app.security.approvals import request_approval, approve
from app.executor import execute_plan
from app.gateway.mock_gateway import MockGateway
from app.executors.naive import run_naive_pipeline
import app.audit as audit

app = FastAPI(title="Dry-Run Agent Hackathon Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Global state for the hackathon UI
EVENTS = []
CURRENT_WINNER = {}
GATEWAY = MockGateway()

class RunRequest(BaseModel):
    command: str

@app.on_event("startup")
def startup():
    init_db()

@app.get("/api/events")
def get_events(since: int = 0):
    """Polling endpoint for the dashboard to get new events."""
    return {"events": EVENTS[since:], "next_index": len(EVENTS)}

def background_dryrun():
    EVENTS.append({"event": "dryrun_started", "ts": int(time.time())})
    plans = generate_plans("Clear pending invoices")
    
    # Run simulated GPU cluster
    results = run_parallel_rollouts(plans)
    
    # Pick winner (highest score)
    winner = max(results, key=lambda x: x["score"])
    
    # Generate Crypto Certificate & Token
    cert = issue_certificate(winner["expanded_plan"], winner["score"], winner["expected_hashes"], winner["needs_approval"])
    token = issue_token(cert["plan_hash"])
    
    if cert["needs_approval"]:
        request_approval(cert["plan_hash"])
        
    global CURRENT_WINNER
    CURRENT_WINNER = {"plan": winner["expanded_plan"], "cert": cert, "token": token}
    
    EVENTS.append({
        "event": "comparison_ready",
        "ts": int(time.time()),
        "data": {"results": results, "winner_id": winner["plan_id"], "cert": cert, "token": token}
    })

@app.post("/api/run")
def start_run(req: RunRequest, bg_tasks: BackgroundTasks):
    EVENTS.clear()
    # Start both naive and dry-run concurrently for the split-screen demo
    bg_tasks.add_task(run_naive_pipeline, DB_PATH, EVENTS)
    bg_tasks.add_task(background_dryrun)
    return {"status": "started"}

@app.post("/api/approve")
def approve_plan():
    if not CURRENT_WINNER:
        raise HTTPException(status_code=400, detail="No active plan")
    approve(CURRENT_WINNER["cert"]["plan_hash"])
    EVENTS.append({"event": "approved", "ts": int(time.time())})
    return {"status": "approved"}

@app.post("/api/execute")
def execute():
    if not CURRENT_WINNER:
        raise HTTPException(status_code=400, detail="No active plan")
    
    try:
        res = execute_plan(CURRENT_WINNER["plan"], CURRENT_WINNER["cert"], CURRENT_WINNER["token"], DB_PATH, GATEWAY)
        EVENTS.append({"event": "execution_result", "ts": int(time.time()), "data": {"status": res}})
        return {"status": res}
    except Exception as e:
        EVENTS.append({"event": "execution_failed", "ts": int(time.time()), "data": {"error": str(e)}})
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/tamper")
def tamper_test():
    """Changes one digit in the plan to prove cryptographic verification fails."""
    if not CURRENT_WINNER:
        raise HTTPException(400, "No active plan")
    
    tampered_plan = CURRENT_WINNER["plan"].copy()
    if tampered_plan["steps"]:
        # Mutate the account number
        tampered_plan["steps"][0]["account"] = "9999999999"
        
    try:
        execute_plan(tampered_plan, CURRENT_WINNER["cert"], CURRENT_WINNER["token"], DB_PATH, GATEWAY)
    except Exception as e:
        EVENTS.append({"event": "tamper_blocked", "ts": int(time.time()), "data": {"error": str(e)}})
        return {"status": "blocked", "error": str(e)}

@app.post("/api/chaos")
def inject_drift():
    """Simulates live DB changing behind our back to trigger drift pause."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Mark invoice 1030 as already paid
    cursor.execute("UPDATE invoices SET status = 'paid' WHERE invoice_id = 'INV-1030'")
    conn.commit()
    conn.close()
    EVENTS.append({"event": "drift_injected", "ts": int(time.time())})
    return {"status": "drift_injected"}

@app.post("/api/reset")
def reset_demo():
    """Restores the database and state in milliseconds."""
    import os
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
    EVENTS.clear()
    audit.CHAIN.clear()
    global CURRENT_WINNER
    CURRENT_WINNER = {}
    return {"status": "reset_ok"}