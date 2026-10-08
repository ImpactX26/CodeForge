def score_plan(total_eligible: int, paid_count: int, rule_status: str, batch_size: int, reversible: bool, needs_approval: bool) -> float:
    if rule_status in ["VETO", "FAIL"]:
        return 0.0
    
    # Base score: Did it finish the job?
    score = 40.0 * (paid_count / max(1, total_eligible))
    # Safety score
    score += 40.0 
    # Blast radius (batches <= 10 get bonus)
    score += 10.0 if batch_size <= 10 else 0.0 
    # Reversibility (gateway hold/void availability)
    score += 10.0 if reversible else 0.0 
    # Friction cost
    score -= 3.0 if needs_approval else 0.0 
    
    return round(score, 2)