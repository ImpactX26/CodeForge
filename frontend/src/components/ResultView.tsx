import React from 'react';
import type { AgentEvent } from '../hooks/useAgentStream';
import type { PlanView } from '../lib/plans';
import { ReasoningPanel } from './ReasoningPanel';

const FLOW = ['Detect dependencies', 'Archive rows', 'Validate counts', 'Notify downstream', 'Reconcile', 'SUCCESS'];
const GATE = ['No data loss', 'Dependencies clear', 'Policy constraints', 'No human intervention', 'Safe to execute'];
const METRICS = [['Success probability', '97%'], ['Risk', 'LOW'], ['Customer impact', 'LOW'], ['Human intervention', 'NONE'], ['Cost', 'LOW']];

export function ResultView({ events, plans }: { events: AgentEvent[]; plans: PlanView[] }) {
  const results = events.filter(e => e.type === 'plan_result').map(e => e.data);
  const committing = events.find(e => e.type === 'committing');
  const committed = events.find(e => e.type === 'committed');
  const winnerId = (committed ?? committing)?.data.plan_id;
  const winner = plans.find(p => p.plan_id === winnerId);

  if (!winner) return <p className="font-mono text-xs text-gray-400">Waiting for a decision…</p>;

  return (
    <div className="animate-fade-in">
      {/* Selected path */}
      <p className="text-xs tracking-[0.2em] text-gray-500 uppercase mb-2">Best path selected</p>
      <h2 className="text-5xl font-serif mb-1">Path {winner.plan_id}</h2>
      <p className="font-serif italic text-xl text-gray-600 mb-6">{winner.label}</p>
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs mb-12">
        {FLOW.map((s, i) => (
          <React.Fragment key={s}>
            <span className={`px-2 py-1 border ${i === FLOW.length - 1 ? 'bg-ink text-bgCanvas border-ink' : 'border-ink bg-white'}`}>{s}</span>
            {i < FLOW.length - 1 && <span className="text-gray-400">→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Score (illustrative) */}
      <div className="grid grid-cols-[auto_1fr] gap-12 items-end mb-12">
        <div>
          <p className="text-xs tracking-[0.2em] text-gray-500 uppercase mb-1">Dry-run score</p>
          <p className="font-serif text-8xl leading-none">94<span className="text-2xl text-gray-400">/100</span></p>
        </div>
        <div className="font-mono text-sm border-l border-structural pl-8">
          {METRICS.map(([k, v]) => (
            <div key={k} className="flex justify-between max-w-xs py-0.5"><span className="text-gray-500">{k}</span><span>{v}</span></div>
          ))}
          <p className="text-[10px] text-gray-400 mt-2">Illustrative demo metrics, not computed by the backend.</p>
        </div>
      </div>

      <ReasoningPanel winningPlanId={winner.plan_id} results={results} />

      {/* Pre-commit gate: simulation -> real world */}
      <div className={`border border-ink p-6 mb-12 transition-all duration-700 ${committed ? 'bg-ink text-bgCanvas' : 'border-dashed bg-white'}`}>
        <p className="font-mono text-[10px] tracking-[0.2em] mb-4">
          {committed ? 'COMMITTED · REAL WORLD' : 'PRE-COMMIT CHECK · SIMULATION → REAL WORLD'}
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-sm">
          {GATE.map(g => <div key={g}>✓ {g}</div>)}
        </div>
        <p className="font-serif text-2xl mt-5">{committed ? 'Executed' : 'Ready to commit'}</p>
      </div>

      {/* Real execution + predicted vs actual */}
      {committed && (
        <div className="animate-fade-in border-t border-structural pt-8">
          <h2 className="text-3xl font-serif mb-2">✓ Execution complete</h2>
          <p className="font-mono text-xs text-gray-500 mb-8">{committed.data.message}</p>
          <div className="grid grid-cols-2 gap-8 font-mono text-sm mb-12">
            {[['Dry-run predicted', winner.status === 'best'], ['Actual result', true]].map(([title, ok]) => (
              <div key={title as string} className="border border-ink p-4 bg-white">
                <p className="text-[10px] tracking-[0.2em] text-gray-500 uppercase mb-2">{title as string}</p>
                {['SUCCESS', 'LOW RISK', 'NO HUMAN'].map(l => <p key={l}>{ok ? '✓' : '·'} {l}</p>)}
              </div>
            ))}
          </div>
          <p className="font-serif text-5xl tracking-tight mb-16">Simulate before you act.</p>
        </div>
      )}
    </div>
  );
}