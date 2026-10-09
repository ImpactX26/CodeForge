import React, { useState, useEffect, useMemo } from 'react';
import type { AgentEvent, Winner } from '../lib/plans';

export function ResultView({
  winner,
  events,
  onAction,
}: {
  winner: Winner | null;
  events: AgentEvent[];
  onAction: (endpoint: string) => Promise<any>;
}) {
  const expiresAt = winner?.cert.expires_at ?? 0;
  const planHash = winner?.cert.plan_hash ?? '';

  const [timeLeft, setTimeLeft] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [localApproved, setLocalApproved] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setTimeLeft(Math.max(0, Math.floor(expiresAt - Date.now() / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // A new plan = a clean slate for the approval button.
  useEffect(() => { setLocalApproved(false); }, [planHash]);

  const last = (...names: string[]) =>
    [...events].reverse().find(e => names.includes(e.event));

  const comparison = useMemo(() => last('comparison_ready'), [events]);
  const reasoning = comparison?.data?.reasoning;
  const winnerId: string = comparison?.data?.winner_id ?? winner?.plan.plan_id ?? '?';

  if (!winner) return null;

  const { cert, token } = winner;
  const executionEvent = last('execution_result', 'execution_failed');
  const tamperEvent = last('tamper_blocked');
  const driftEvent = last('drift_injected');
  const isApproved = localApproved || events.some(e => e.event === 'approved');
  const expired = timeLeft <= 0;

  const run = async (name: string) => {
    setBusy(name);
    try {
      const res = await onAction(name);
      if (name === 'approve' && res?.status === 'approved') setLocalApproved(true);
    } finally {
      setBusy(null);
    }
  };

  const ranking: { plan_id: string; score: number }[] = reasoning?.ranking ?? [];

  return (
    <div className="mt-6 border-t border-structural pt-5 animate-fade-in flex flex-col gap-5 font-mono">

      {/* 1. WHY THE WINNER WON */}
      <div className="bg-ink text-bgCanvas p-5 shadow-lg border-l-4 border-emerald-400">
        <h3 className="text-xs tracking-widest uppercase mb-3 text-emerald-400 font-bold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Why Plan {winnerId} won
        </h3>
        <p className="font-sans text-sm leading-relaxed opacity-95">
          {reasoning?.summary ?? `Plan ${winnerId} achieved the highest safety score (${cert.score}/100).`}
        </p>

        {reasoning?.checks && (
          <ul className="mt-4 space-y-1.5 text-xs font-sans opacity-90">
            {reasoning.checks.map((c: string) => (
              <li key={c} className="flex gap-2"><span className="text-emerald-400">✓</span><span>{c}</span></li>
            ))}
          </ul>
        )}

        {ranking.length > 0 && (
          <div className="mt-5 space-y-1.5">
            {ranking.map(r => (
              <div key={r.plan_id} className="flex items-center gap-3 text-[10px] tracking-widest">
                <span className={`w-12 ${r.plan_id === winnerId ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>PLAN {r.plan_id}</span>
                <div className="flex-1 h-[4px] bg-gray-700">
                  <div
                    className={`h-full transition-all duration-1000 ${r.plan_id === winnerId ? 'bg-emerald-400' : 'bg-gray-400'}`}
                    style={{ width: `${Math.max(2, r.score)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-300">{r.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. CRYPTOGRAPHIC CERTIFICATE */}
      <div className="border border-ink p-5 bg-[#0a0a0a] text-[#39ff14] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between border-b border-gray-800 pb-3 mb-4 text-xs text-gray-400 font-bold tracking-widest">
          <span>Ed25519 ASYMMETRIC PROOF</span>
          <span className={expired || timeLeft < 15 ? 'text-coral animate-pulse' : 'text-gray-300'}>
            {expired ? 'EXPIRED: RE-RUN TO ISSUE A NEW ONE' : `TTL: ${timeLeft}s REMAINING`}
          </span>
        </div>
        <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-xs break-all">
          <span className="text-gray-500">PLAN_HASH</span>
          <span className="text-white">{cert.plan_hash}</span>
          <span className="text-gray-500">SIGNATURE</span>
          <span className="text-amber-300">{cert.signature.slice(0, 52)}...</span>
          <span className="text-gray-500">SINGLE_TOKEN</span>
          <span className="text-sky-400">{token}</span>
        </div>
      </div>

      {/* 3. LIVE NOTIFICATIONS */}
      {(driftEvent || tamperEvent || executionEvent) && (
        <div className="space-y-3 text-sm">
          {driftEvent && (
            <div className="border-l-4 border-amber-600 bg-amber-50 text-amber-900 p-3 shadow-sm">
              ⚠️ <strong>DRIFT INJECTED:</strong> {driftEvent.data?.invoice_id ?? 'an invoice'} was changed behind the agent's back in the live database. Execution must now pause.
            </div>
          )}
          {tamperEvent && (
            <div className="border-l-4 border-coral bg-coral/10 text-coral p-3 shadow-sm">
              🛡️ <strong>TAMPER REFUSED:</strong> one account number was edited after signing. Verification said: "{tamperEvent.data?.error}". Nothing was executed.
            </div>
          )}
          {executionEvent && (
            <div className={`p-3 border-l-4 shadow-sm ${
              executionEvent.data?.status === 'DONE'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                : 'border-amber-600 bg-amber-50 text-amber-900'
            }`}>
              {executionEvent.event === 'execution_failed' ? (
                <><strong>EXECUTION REFUSED:</strong> {executionEvent.data?.error}</>
              ) : executionEvent.data?.status === 'DONE' ? (
                <><strong>EXECUTION COMPLETE:</strong> {executionEvent.data?.payments} payments captured in verified batches. Live loss: Rs 0.</>
              ) : (
                <><strong>PAUSED, DRIFT DETECTED:</strong> live data no longer matches what was simulated. The gateway hold was voided and no further money moved.</>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. ACTIONS */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <button
          onClick={() => run('approve')}
          disabled={isApproved || busy !== null || !cert.needs_approval}
          className={`py-3.5 px-4 border-2 transition-all font-bold tracking-wide ${
            isApproved
              ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
              : !cert.needs_approval
                ? 'border-gray-300 text-gray-400'
                : 'border-ink hover:bg-gray-100'
          }`}
        >
          {isApproved ? '✓ 1. APPROVED' : !cert.needs_approval ? '1. NO APPROVAL NEEDED' : busy === 'approve' ? 'APPROVING...' : '1. APPROVE PLAN'}
        </button>

        <button
          onClick={() => run('execute')}
          disabled={busy !== null}
          className="bg-ink text-white py-3.5 px-4 hover:opacity-90 font-bold tracking-wide transition-opacity disabled:opacity-50"
        >
          {busy === 'execute' ? 'EXECUTING...' : '2. EXECUTE SAFELY'}
        </button>

        <button
          onClick={() => run('tamper')}
          disabled={busy !== null}
          className="border-2 border-coral text-coral hover:bg-coral hover:text-white py-2.5 px-4 font-bold text-xs transition-colors disabled:opacity-50"
        >
          TEST TAMPER RESISTANCE
        </button>

        <button
          onClick={() => run('chaos')}
          disabled={busy !== null}
          className="border-2 border-gray-400 text-gray-600 hover:bg-gray-200 py-2.5 px-4 font-bold text-xs transition-colors disabled:opacity-50"
        >
          INJECT STATE DRIFT
        </button>
      </div>
    </div>
  );
}