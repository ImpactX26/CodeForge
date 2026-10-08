class MockGateway:
    def __init__(self):
        self.holds = {}
        self.idempotency_store = {}

    def authorize(self, batch_steps: list) -> dict:
        hold_id = f"hold_{len(self.holds)+1}"
        total_amount = sum(s["amount"] for s in batch_steps)
        self.holds[hold_id] = {"status": "authorized", "amount": total_amount, "steps": batch_steps}
        return {"hold_id": hold_id, "status": "authorized"}

    def capture(self, hold_id: str):
        if hold_id in self.holds:
            self.holds[hold_id]["status"] = "captured"

    def void(self, hold_id: str):
        if hold_id in self.holds:
            self.holds[hold_id]["status"] = "voided"