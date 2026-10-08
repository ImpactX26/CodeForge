import type { AgentEvent } from '../hooks/useAgentStream';

export type PlanStatus = 'pending' | 'testing' | 'passed' | 'failed' | 'best';
export interface PlanView { plan_id: string; label: string; status: PlanStatus; reason?: string }

export function derivePlans(events: AgentEvent[]): PlanView[] {
  const raw = events.find(e => e.type === 'plans_generated')?.data.plans ?? [];
  const results = new Map<string, any>();
  events.filter(e => e.type === 'plan_result').forEach(e => results.set(e.data.plan_id, e.data));
  const testingId = [...events].reverse().find(e => e.type === 'plan_testing')?.data.plan_id;
  const winnerId = events.find(e => e.type === 'committing' || e.type === 'committed')?.data.plan_id;

  return raw.map((p: any) => {
    const r = results.get(p.plan_id);
    const status: PlanStatus =
      p.plan_id === winnerId ? 'best'
      : r ? r.status
      : p.plan_id === testingId ? 'testing'
      : 'pending';
    return { plan_id: p.plan_id, label: p.label, status, reason: r?.reason };
  });
}