import React, { useEffect, useState } from 'react';
import type { PlanView, PlanStatus } from '../lib/plans';

const STYLE: Record<PlanStatus, string> = {
  pending: 'border-structural text-gray-400',
  testing: 'border-ink bg-white animate-pulse',
  passed: 'border-ink bg-white',
  failed: 'border-coral/50 bg-coral/5 opacity-60 scale-95',
  best: 'border-ink bg-ink text-bgCanvas',
};
const TAG: Record<PlanStatus, string> = {
  pending: 'PENDING', testing: 'TESTING', passed: 'SAFE', failed: 'FAILED', best: 'BEST',
};

export function FutureTree({ plans }: { plans: PlanView[] }) {
  const n = plans.length;
  if (!n) return <p className="font-mono text-xs text-gray-400">Waiting for the agent to generate futures…</p>;

  return (
    <div>
      <div className="flex flex-col items-center">
        <span className="font-mono text-[10px] tracking-[0.2em] border border-ink px-3 py-1">AGENT PLAN</span>
        <div className="w-px h-5 bg-ink" />
      </div>
      <div className="relative">
        <div className="absolute top-0 h-px bg-ink" style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {plans.map(p => {
            const ok = p.status === 'passed' || p.status === 'best';
            return (
              <div key={p.plan_id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-ink" />
                <div className={`w-full border p-3 transition-all duration-500 ${STYLE[p.status]}`}>
                  <div className="flex justify-between font-mono text-[10px] tracking-[0.15em] mb-1">
                    <span>PATH {p.plan_id}</span>
                    <span className={p.status === 'failed' ? 'text-coral' : ''}>{TAG[p.status]}</span>
                  </div>
                  <p className={`font-serif text-sm leading-snug ${p.status === 'failed' ? 'line-through' : ''}`}>{p.label}</p>
                  {p.reason && <p className="font-mono text-[10px] mt-2 opacity-80">{p.reason}</p>}
                  {ok && <p className="font-mono text-[10px] mt-2 opacity-80">Risk LOW · Human NONE</p>}
                  {p.status === 'failed' && <p className="font-mono text-[10px] mt-2 text-coral">Human intervention: REQUIRED</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="font-mono text-[10px] text-gray-400 mt-3">Risk / effort labels are derived from pass/fail, not backend-scored.</p>
    </div>
  );
}

const STEPS = ['AGENT', 'DATABASE', 'PAYMENT', 'NOTIFY', 'CUSTOMER'];

export function SignalFlow({ plan }: { plan?: PlanView }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % STEPS.length), 450);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-[3.5rem] mt-8 font-mono text-[10px]">
      {plan ? (
        <>
          <p className="tracking-[0.2em] text-gray-500 mb-2">SIMULATING PATH {plan.plan_id} (illustrative flow)</p>
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => (
              <React.Fragment key={s}>
                <span className={`px-2 py-1 border transition-colors duration-300 ${idx === i ? 'bg-ink text-bgCanvas border-ink' : 'border-structural text-gray-400'}`}>{s}</span>
                {idx < STEPS.length - 1 && <span className="text-gray-300">→</span>}
              </React.Fragment>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function EliminationTally({ plans }: { plans: PlanView[] }) {
  if (!plans.length) return null;
  const failed = plans.filter(p => p.status === 'failed').length;
  const safe = plans.filter(p => p.status === 'passed' || p.status === 'best').length;
  const best = plans.some(p => p.status === 'best') ? 1 : 0;
  const items = [
    [`${plans.length} futures`, true],
    [`${failed} failed`, failed > 0],
    [`${safe} safe`, safe > 0],
    [`${best} best path`, best > 0],
  ] as const;

  return (
    <div className="flex items-center gap-3 font-mono text-xs mt-6">
      {items.map(([label, on], idx) => (
        <React.Fragment key={label}>
          <span className={`transition-opacity duration-500 ${on ? 'text-ink' : 'text-gray-300'}`}>{label}</span>
          {idx < items.length - 1 && <span className="text-gray-300">→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}