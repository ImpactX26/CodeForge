from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class PlanParams(BaseModel):
    skip_duplicates: bool
    hold_bank_changed: bool
    max_per_payment: float
    batch_size: int
    order: str

class Plan(BaseModel):
    plan_id: str
    strategy: str
    params: PlanParams

class Step(BaseModel):
    invoice_id: str
    vendor_id: str
    amount: float
    account: str
    ifsc: str
    idem_key: str

class ExpandedPlan(BaseModel):
    plan_id: str
    steps: List[Step]
    held: List[Dict[str, Any]]