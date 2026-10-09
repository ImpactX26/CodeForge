import React, { useEffect, useMemo, useRef } from 'react';
import { useAgentStream } from '../hooks/useAgentStream';
import { ForkStage } from '../components/ForkStage';
import { FutureTree } from '../components/FutureTree';
import { ResultView } from '../components/ResultView';

export function DryRunPage({
  initialTask,
  txCount,
  apiBaseUrl,
  onReset,
}: {
  initialTask: string;
  txCount: number;
  apiBaseUrl: string;
  onReset: () => void;
}) {
  const { events, winner, startRun, executeAction } = useAgentStream(apiBaseUrl);
  const hasStarted = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startRun(initialTask, txCount);
    }
  }, [initialTask, txCount]);

  const naiveSteps = useMemo(() => events.filter(e => e.event === 'naive_step'), [events]);
  const naiveDone = events.find(e => e.event === 'naive_done');
  const naiveError = events.find(e => e.event === 'naive_error');
  const naiveStarted = events.find(e => e.event === 'naive_started');

  const currentDamage: number = naiveDone
    ? naiveDone.data.total_damage
    : naiveSteps.length > 0
      ? naiveSteps[naiveSteps.length - 1].data.damage_so_far
      : 0;

  const comparisonReady = events.some(e => e.event === 'comparison_ready');
  const dryrunError = events.some(e => e.event === 'dryrun_error');
  const forked = events.some(e => e.event === 'dryrun_started');

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [naiveSteps.length]);

  return (
    <div className="bg-bgCanvas text-ink min-h-screen flex flex-col font-sans selection:bg-structural">
      <div className="border-b border-structural px-8 py-3.5 flex justify-between items-center bg-white z-20 sticky top-0 font-mono">
        <div className="text-xs">
          <span className="text-gray-400 mr-2">DIRECTIVE:</span>
          <span className="font-bold">{initialTask}</span>
          <span className="text-gray-400 ml-4">{txCount} invoices</span>
        </div>
        <div className="flex gap-3 text-xs">
          <button
            onClick={() => startRun(initialTask, txCount)}
            className="bg-ink text-white px-4 py-1.5 hover:opacity-85 transition-opacity font-bold tracking-widest"
          >
            RE-RUN SEQUENCE
          </button>
          <button
            onClick={() => executeAction('reset').then(onReset)}
            className="border border-ink px-4 py-1.5 hover:bg-gray-50 transition-colors"
          >
            ← RESET & BACK
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 divide-x divide-structural">
        {/* ================= LEFT PANEL: NAIVE EXECUTION ================= */}
        <div className="p-8 relative bg-gray-50/60 flex flex-col h-[calc(100vh-60px)]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <span className="text-xs tracking-[0.2em] text-coral uppercase font-mono font-bold">NAIVE AGENT · UNGUARDED</span>
            <span className="text-[10px] font-mono text-gray-400">
              {naiveStarted ? `PAID ${naiveSteps.length} / ${naiveStarted.data.total}` : 'RAW SQL'}
            </span>
          </div>

          <div
            ref={logRef}
            className="font-mono text-sm overflow-y-auto max-h-[35vh] min-h-[150px] border-l-2 border-coral pl-4 pr-2 space-y-2 bg-white/70 p-4 shadow-inner mb-4 relative shrink-0"
          >
            {naiveSteps.length === 0 ? (
              <p className="text-gray-400 italic animate-pulse">Executing directly on the database...</p>
            ) : (
              naiveSteps.map((e, i) => {
                const flag = e.data.flag;
                const bad = !!flag;
                return (
                  <div
                    key={i}
                    className={`py-1 transition-all duration-300 ${bad ? 'text-coral font-bold bg-coral/10 px-2 border-l-4 border-coral' : 'text-gray-600'}`}
                  >
                    <span className="text-gray-400">[{new Date(e.ts * 1000).toISOString().split('T')[1].slice(0, 8)}]</span>{' '}
                    Disbursing {e.data.invoice_id} (Rs {Number(e.data.amount).toLocaleString()})...
                    {flag === 'duplicate' && ' ⚠️ [DUPLICATE EXECUTED]'}
                    {flag === 'bank_changed' && ' 🚨 [BANK CHANGED RECENTLY]'}
                  </div>
                );
              })
            )}
          </div>

          {naiveError && (
            <div className="border-2 border-coral text-coral p-4 text-xs font-mono mb-4">
              Naive agent crashed: {naiveError.data?.error}
            </div>
          )}

          {naiveDone && (
            <div className="border-2 border-coral bg-coral/5 p-6 shadow-lg relative overflow-hidden flex-1 flex flex-col justify-center mb-4 transition-all duration-700 animate-in slide-in-from-bottom-2">
              <div className="absolute top-0 left-0 w-1 h-full bg-coral animate-pulse" />
              <h2 className="text-3xl font-serif text-coral mb-4">Catastrophic Failure Detected</h2>
              <div className="font-mono text-sm text-coral/90 space-y-3">
                <p>❌ Paid {naiveDone.data.duplicates} duplicate invoice(s): Rs {Number(naiveDone.data.duplicate_amount).toLocaleString()}</p>
                <p>❌ Sent {naiveDone.data.bank_changed} payment(s) to recently altered vendor accounts: Rs {Number(naiveDone.data.bank_changed_amount).toLocaleString()}</p>
                <p className="font-sans text-xs leading-relaxed text-coral/80 pt-3 border-t border-coral/20">
                  {naiveDone.data.explanation}
                </p>
                <p className="font-bold pt-3 border-t border-coral/20">The agent lacked a sandbox to simulate these outcomes.</p>
              </div>
            </div>
          )}

          <div className="border-t-2 border-coral pt-4 shrink-0 mt-auto">
            <p className="font-mono text-[10px] tracking-widest text-coral uppercase mb-1">CAPITAL DEPLETED</p>
            <div className="flex justify-between items-baseline">
              <p className="font-serif text-6xl text-coral tracking-tight">
                - Rs {currentDamage.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* ================= RIGHT PANEL: DRY-RUN PIPELINE ================= */}
        <div className="p-8 relative flex flex-col justify-between overflow-y-auto h-[calc(100vh-60px)]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs tracking-[0.2em] text-gray-600 uppercase font-mono font-bold">DRY-RUN AGENT · MULTI-FUTURE</span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-300">ACTIVE ISOLATION</span>
            </div>

            {/* Waiting State 1: Before Naive is done */}
            {!forked && !naiveDone && (
              <div className="mt-32 flex flex-col items-center justify-center opacity-40">
                <div className="w-8 h-8 border-2 border-gray-400 border-t-ink rounded-full animate-spin mb-6" />
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-gray-500">
                  Waiting for unguarded execution to complete...
                </p>
              </div>
            )}

            {/* Waiting State 2: Suspense gap between Naive failing and Dry-run starting */}
            {!forked && naiveDone && (
              <div className="mt-32 flex flex-col items-center justify-center animate-in fade-in duration-1000">
                <p className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-ink animate-pulse">
                  Initializing Isolated Sandboxes...
                </p>
              </div>
            )}

            {forked && (
              <div className="animate-in fade-in duration-500">
                <ForkStage forked={forked} message="live.db cloned to ephemeral sandbox_A..F databases." />
                <FutureTree events={events} />
                {comparisonReady && !dryrunError && (
                  <ResultView winner={winner} events={events} onAction={executeAction} />
                )}
              </div>
            )}
          </div>

          <div className="border-t border-ink pt-4 mt-8 shrink-0">
            <p className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-1">PRODUCTION IMPACT</p>
            <div className="flex justify-between items-baseline">
              <p className="font-serif text-6xl text-ink tracking-tight">Rs 0</p>
              <span className="font-mono text-xs text-emerald-700 font-bold">✓ SAFE TO EXECUTE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}