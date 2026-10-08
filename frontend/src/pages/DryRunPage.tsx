import React, { useEffect, useState } from 'react';
import { useAgentStream } from '../hooks/useAgentStream';
import { TimelineGuide } from '../components/TimelineGuide';
import { ForkStage } from '../components/ForkStage';
import { FutureTree, SignalFlow, EliminationTally } from '../components/FutureTree';
import { ResultView } from '../components/ResultView';
import { derivePlans } from '../lib/plans';

export function DryRunPage({ 
  initialTask, 
  apiBaseUrl, 
  onReset 
}: { 
  initialTask: string; 
  apiBaseUrl: string; 
  onReset: () => void; 
}) {
  const { startRun, events, status } = useAgentStream();

  // Automatically start the stream when entering Page 2
  useEffect(() => {
    startRun(initialTask, 'dry-run');
  }, [initialTask, startRun]);

    const [view, setView] = useState<'simulate' | 'result'>('simulate');
  const seen = (t: string) => events.some(e => e.type === t);
  const plans = derivePlans(events);
  const forkEvent = events.find(e => e.type === 'fork_started');
  const committing = seen('committing');

  // Auto-advance to RESULT shortly after the commit phase begins
  useEffect(() => {
    if (!committing) return;
    const t = setTimeout(() => setView('result'), 1200);
    return () => clearTimeout(t);
  }, [committing]);

  const stage = 1 + ['fork_started', 'plans_generated', 'plan_testing', 'plan_result', 'committing', 'committed']
    .filter(seen).length + (status === 'complete' ? 1 : 0);

  const realm = committing ? 'commit' : forkEvent ? 'sandbox' : 'production';
  const realmStyle = (r: string) =>
    r !== realm ? 'border-transparent text-gray-300'
    : r === 'production' ? 'border-ink'
    : r === 'sandbox' ? 'border-ink border-dashed'
    : 'border-ink bg-ink text-bgCanvas';

  const activePlan = plans.find(p => p.status === 'testing');

  return (
    <div className="bg-bgCanvas text-ink min-h-screen flex font-sans selection:bg-structural">
      <TimelineGuide activeStages={stage} />

      <div className="max-w-4xl pt-12 pl-16 pb-12 w-full relative">
        <div className="flex justify-between items-center mb-6 font-mono text-xs">
          <div className="flex gap-6">
            <button onClick={() => setView('simulate')} className={view === 'simulate' ? 'border-b border-ink' : 'text-gray-400'}>SIMULATE</button>
            <button onClick={() => setView('result')} disabled={!committing} className={view === 'result' ? 'border-b border-ink' : 'text-gray-400 disabled:opacity-40'}>RESULT</button>
          </div>
          <div className="flex gap-2 tracking-[0.15em] text-[10px]">
            {['production', 'sandbox', 'commit'].map(r => (
              <span key={r} className={`border px-2 py-1 uppercase transition-all duration-500 ${realmStyle(r)}`}>{r}</span>
            ))}
          </div>
          <button onClick={onReset} className="text-gray-500 hover:text-ink border border-gray-300 px-3 py-1 transition-colors">← BACK</button>
        </div>

        <p className="text-xs tracking-[0.2em] text-gray-500 uppercase mb-2">Target task</p>
        <h1 className="text-3xl font-serif mb-6">{initialTask}</h1>
        <hr className="border-structural mb-8" />

        {view === 'simulate' ? (
          <>
            <ForkStage forked={!!forkEvent} message={forkEvent?.data.message} />
            <p className="text-xs tracking-[0.2em] text-gray-500 uppercase mb-4">Candidate futures</p>
            <FutureTree plans={plans} />
            <SignalFlow plan={activePlan} />
            <EliminationTally plans={plans} />
          </>
        ) : (
          <ResultView events={events} plans={plans} />
        )}
      </div>
    </div>
  );
}