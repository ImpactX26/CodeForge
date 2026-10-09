export interface Certificate {
  plan_hash: string;
  score: number;
  expected: string[];
  needs_approval: boolean;
  expires_at: number;
  signature: string;
}

export interface ExpandedPlan {
  plan_id: string;
  strategy?: string;
  batch_size?: number;
  steps: any[];
  held: any[];
}

export interface AgentEvent {
  event: string;
  ts: number;
  data?: any;
}

export type PlanStatus = 'pending' | 'testing' | 'passed' | 'failed' | 'best' | 'veto';

export interface PlanView {
  plan_id: string;
  label: string;
  status: PlanStatus;
  reason?: string;
  score?: number;
}

/** One simulated plan, exactly as the backend sends it in `comparison_ready`. */
export interface PlanResult {
  plan_id: string;
  strategy: string;
  status: 'PASS' | 'VETO' | 'FAIL';
  reason: string;
  score: number;
  needs_approval: boolean;
  pay_count: number;
  held_count: number;
  clean_paid: number;
  total_eligible: number;
  dup_count: number;
  fraud_count: number;
  total_amount: number;
  batch_size: number;
  success_pct: number;
  expanded_plan?: ExpandedPlan;
}

export interface Reasoning {
  summary: string;
  checks: string[];
  per_plan: Record<string, string>;
  ranking: { plan_id: string; score: number }[];
}

export interface Winner {
  plan: ExpandedPlan;
  cert: Certificate;
  token: string;
}