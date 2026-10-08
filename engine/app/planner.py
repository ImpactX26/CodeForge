import json
import os

def generate_plans(task: str) -> list:
    """
    Simulates calling an LLM. 
    In the hackathon, we load from fallback_plans.json to guarantee 100% reliability.
    """
    path = os.path.join(os.path.dirname(__file__), "..", "data", "fallback_plans.json")
    with open(path, "r") as f:
        return json.load(f)