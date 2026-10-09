def score_plan(
    total_eligible: int,
    paid_count: int,          # number of CLEAN invoices the plan pays
    rule_status: str,         # PASS | VETO | FAIL
    batch_size: int,
    reversible: bool,
    needs_approval: bool,
    violations: int = 0,      # duplicate / fraud payments the plan attempted
    total_steps: int = 0,     # total payments the plan attempted
) -> int:
    """0-100 score. Safe + complete + small blast radius wins.

    PASS : 40 completion + 40 safety + 10 small batches + 10 reversible - 3 approval friction
    VETO : at most 25, scaled down by the share of its payments that were violations
    FAIL : at most 10 (broke the spending limit)
    """
    ratio = min(1.0, paid_count / max(1, total_eligible))

    if rule_status == "VETO":
        bad_rate = violations / max(1, total_steps)
        return max(0, int(round(25 * ratio * (1 - min(1.0, bad_rate * 5)))))
    if rule_status == "FAIL":
        return max(0, int(round(10 * ratio)))

    score = 40 * ratio          # how much of the job got done
    score += 40                 # passed every safety rule
    if batch_size <= 10:
        score += 10             # small blast radius
    if reversible:
        score += 10             # gateway hold / void available
    if needs_approval:
        score -= 3              # human friction
    return int(round(score))