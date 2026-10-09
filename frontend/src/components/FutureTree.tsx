import React, { useState, useEffect, useMemo } from 'react';
import type { AgentEvent } from '../lib/plans';

// What each plan DOES (static explanation). Scores, status and the
// "why" text on hover always come from the backend's live LLM generation.
const PLAN_META: Record<string, { name: string; detail: string }> = {
  A: { name: 'Blind Aggressive', detail: 'Pays every pending invoice at once, duplicates and risky vendors included. Shows what happens with no safeguards at all.' },
  B: { name: 'Deduplicated Only', detail: 'Drops duplicate invoices but still pays vendors whose bank details just changed. A half-safe shortcut.' },
  C: { name: 'Staged & Verified', detail: 'Skips duplicates, holds bank-changed vendors for a human, and pays the rest in small batches of 10, checking after each batch.' },
  D: { name: 'Monolithic Batch', detail: 'Same safe selection as Plan C, but pays everything in one giant batch. If anything goes wrong, everything goes wrong.' },
  E: { name: 'High-Value Only', detail: 'Pays only the biggest clean invoices (over Rs 5 lakh) in small batches. Safe, but most of the work stays undone.' },
  F: { name: 'Complete Halt', detail: 'Pays nothing and escalates every invoice to a person. Zero risk, zero progress.' },
};

const PLAN_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];

const KEYFRAMES = `
@keyframes slideDown { 0% { transform: translateY(-120%); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(220%); opacity: 0; } }
@keyframes slideUp   { 0% { transform: translateY(300%); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(-100%); opacity: 0; } }
@keyframes cardIn    { 0% { transform: translateY(18px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
`;

export function FutureTree({ events }: { events: AgentEvent[] }) {
  const isStarted = events.some(e => e.event === 'dryrun_started');
  const plansEvt = events.find(e => e.event === 'plans_generated');
  const errorEvt = events.find(e => e.event === 'dryrun_error');
  const comparison = useMemo(
    () => [...events].reverse().find(e => e.event === 'comparison_ready'),
    [events]
  );

  const results: any[] = comparison?.data?.results ?? [];
  const winnerId: string | undefined = comparison?.data?.winner_id;
  const perPlan: Record<string, string> = comparison?.data?.reasoning?.per_plan ?? {};
  const planInfos: any[] = plansEvt?.data?.plans ?? [];
  const hasResults = results.length > 0;

  // phase: 0 idle | 1 forking | 2 generating cards | 3 waiting for results | 4 winner revealed
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Start / restart whenever a (new) dry-run begins.
  useEffect(() => {
    if (!isStarted) {
      setPhase(0);
      setActiveIndex(-1);
    } else if (phase === 0) {
      setPhase(1);
    }
  }, [isStarted, phase]);

  useEffect(() => {
    if (phase !== 1) return;
    const t = setTimeout(() => setPhase(2), 800);
    return () => clearTimeout(t);
  }, [phase]);

  // Cards appear one by one: A -> F
  useEffect(() => {
    if (phase !== 2) return;
    if (activeIndex < PLAN_IDS.length - 1) {
      const t = setTimeout(() => setActiveIndex(i => i + 1), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase(3), 1000);
    return () => clearTimeout(t);
  }, [phase, activeIndex]);

  // Reveal the winner as soon as the backend results are in.
  useEffect(() => {
    if (phase !== 3 || !hasResults) return;
    const t = setTimeout(() => setPhase(4), 700);
    return () => clearTimeout(t);
  }, [phase, hasResults]);

  if (!isStarted) return null;

  const caption =
    errorEvt ? 'Simulation failed'
    : phase <= 1 ? 'Forking production into isolated sandboxes...'
    : phase === 2 ? `Generating candidate futures... Plan ${PLAN_IDS[Math.max(0, activeIndex)]}`
    : phase === 3 ? (hasResults ? 'Scoring outcomes...' : 'Running all 6 sandboxes in parallel...')
    : `Plan ${winnerId} selected: highest safety score`;

  return (
    <div className="mt-6 flex flex-col items-center w-full max-w-5xl mx-auto font-mono">
      <style>{KEYFRAMES}</style>

      {/* 1. THE ORIGIN TRUNK */}
      <div className="flex flex-col items-center z-10 w-full">
        <div className="border border-ink bg-white px-5 py-2 text-[10px] tracking-widest uppercase shadow-sm">PRODUCTION</div>
        <div className="w-px h-6 bg-gray-300 relative overflow-hidden">
          {phase >= 1 && phase < 4 && <div className="absolute top-0 left-0 w-full h-1/2 bg-ink animate-[slideDown_1s_ease-out_infinite]" />}
        </div>
        <div className={`border px-4 py-1.5 text-[10px] tracking-widest uppercase transition-all duration-700 ${phase >= 1 ? 'bg-white border-ink text-ink' : 'bg-gray-50 border-gray-300 text-gray-400'}`}>
          SANDBOX FORK
        </div>
        <div className="w-px h-6 bg-gray-300 relative overflow-hidden">
          {phase >= 1 && phase < 4 && <div className="absolute top-0 left-0 w-full h-1/2 bg-ink animate-[slideDown_1s_ease-out_infinite]" />}
        </div>
        <div className={`border-2 px-6 py-2 text-xs font-bold tracking-widest uppercase transition-all duration-700 ${phase >= 1 ? 'border-ink bg-ink text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)]' : 'border-gray-300 bg-gray-50 text-gray-400'}`}>
          PARALLEL SIMULATION ENGINE
        </div>
        <div className="w-px h-8 bg-ink relative z-0">
          {phase >= 2 && phase < 4 && <div className="absolute top-0 left-[-2.5px] w-[6px] h-[6px] bg-ink rounded-full animate-[ping_1.2s_ease-out_infinite]" />}
        </div>
        <p className={`mt-2 text-[10px] tracking-widest uppercase ${errorEvt ? 'text-coral font-bold' : 'text-gray-500'} ${phase < 4 && !errorEvt ? 'animate-pulse' : ''}`}>
          {caption}
        </p>
      </div>

      {errorEvt && (
        <div className="w-full mt-4 border-2 border-coral bg-coral/5 text-coral p-4 text-xs">
          <strong>Backend error:</strong> {errorEvt.data?.error}. Check the Uvicorn terminal, fix it, then press RE-RUN SEQUENCE.
        </div>
      )}

      {/* 2. THE BRANCHING EXECUTION GRAPH */}
      <div className="w-full relative mt-2">
        <div className={`absolute top-0 left-[16.66%] right-[16.66%] h-px transition-colors duration-1000 z-0 ${phase >= 2 ? 'bg-ink' : 'bg-transparent'}`} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12 relative z-10 pt-6">
          {PLAN_IDS.map((id, idx) => {
            const result = results.find((r: any) => r.plan_id === id);
            const info = result || planInfos.find((p: any) => p.plan_id === id);
            const isPending = phase <= 1 || (phase === 2 && idx > activeIndex);
            const isActive = phase === 2 && idx === activeIndex;
            const isEvaluated = phase >= 3 || (phase === 2 && idx < activeIndex);
            
            return (
              <ExecutionNode
                key={id}
                id={id}
                idx={idx}
                result={result}
                info={info}
                hoverText={perPlan[id]}
                isWinner={id === winnerId}
                isPending={isPending}
                isActive={isActive}
                isEvaluated={isEvaluated}
                isReveal={phase === 4}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ================= INDIVIDUAL EXECUTION NODE =================
function ExecutionNode({ id, idx, result, info, hoverText, isWinner, isPending, isActive, isEvaluated, isReveal }: any) {
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState(-1);
  const meta = PLAN_META[id];

  useEffect(() => {
    if (isActive) {
      const t0 = setTimeout(() => setStage(0), 50);
      const t1 = setTimeout(() => setStage(1), 250);
      const t2 = setTimeout(() => setStage(2), 450);
      const t3 = setTimeout(() => setStage(3), 650);
      return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    } else if (isEvaluated || isReveal) {
      setStage(3);
    } else {
      setStage(-1);
    }
  }, [isActive, isEvaluated, isReveal]);

  if (isPending) return <div className="min-h-[220px] opacity-0 pointer-events-none" />;

  const showResult = !!result && isEvaluated;
  const rejected = showResult && (result.status === 'VETO' || result.status === 'FAIL');
  const winnerCard = isReveal && isWinner;

  let cardStyle = 'border border-gray-300 bg-white';
  let dropLineStyle = 'bg-ink/30';

  if (isReveal) {
    if (isWinner) {
      cardStyle = 'border-2 border-ink bg-ink text-white shadow-2xl scale-[1.05] z-20 ring-4 ring-ink/20';
      dropLineStyle = 'bg-ink w-[2px] shadow-[0_0_10px_rgba(0,0,0,0.5)]';
    } else {
      cardStyle = 'border border-gray-200 bg-gray-50 text-gray-500 opacity-60 grayscale scale-[0.98] hover:opacity-100 hover:grayscale-0';
      dropLineStyle = 'bg-gray-200';
    }
  } else if (isActive) {
    cardStyle = 'border-2 border-emerald-500 bg-white shadow-[0_8px_30px_rgba(16,185,129,0.15)] scale-[1.02] z-20';
    dropLineStyle = 'bg-emerald-500 w-[2px] shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  } else if (isEvaluated) {
    cardStyle = 'border border-gray-400 bg-white opacity-95';
    dropLineStyle = 'bg-gray-400';
  }

  const statusLabel = winnerCard ? (
    <span className="text-emerald-400">★ OPTIMAL SAFETY PROVEN</span>
  ) : showResult ? (
    <span className={rejected ? 'text-coral' : 'text-emerald-600'}>
      {result.status === 'PASS' ? '✓ PASSED' : result.status === 'VETO' ? '✕ VETOED' : '✕ FAILED'}
    </span>
  ) : (
    <span className="opacity-70 text-emerald-600 animate-pulse">
      {isActive ? 'EVALUATING...' : 'SIMULATING...'}
    </span>
  );

  const score: number | undefined = showResult ? result.score : undefined;

  return (
    <div
      className="relative flex flex-col items-center cursor-pointer"
      style={{ animation: 'cardIn 0.5s ease-out both' }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className={`absolute -top-6 w-px h-6 transition-all duration-500 ${dropLineStyle}`}>
        {isActive && <div className="absolute top-0 left-[-1.5px] w-[4px] h-[10px] bg-emerald-500 rounded-full animate-[slideDown_0.6s_ease-out_infinite]" />}
        {winnerCard && <div className="absolute bottom-0 left-[-1.5px] w-[5px] h-[15px] bg-white rounded-full animate-[slideUp_1.5s_ease-in-out_infinite]" />}
      </div>

      <div className={`w-full p-5 transition-all duration-700 flex flex-col justify-between overflow-hidden ${cardStyle} ${expanded && stage === 3 ? 'min-h-[380px]' : 'min-h-[240px]'}`}>
        <div>
          <div className="flex justify-between items-start text-[10px] tracking-widest mb-3 uppercase">
            <span className={`font-bold ${winnerCard ? 'text-emerald-300' : isActive ? 'text-emerald-600' : ''}`}>PLAN {id}</span>
            <span className={`border px-1.5 py-0.5 ${winnerCard ? 'border-gray-500' : 'border-gray-200'}`}>node-{idx + 1}</span>
          </div>

          <h3 className="text-lg font-serif leading-tight mb-2 tracking-tight">{meta.name}</h3>
          <p className={`text-xs font-sans leading-relaxed mb-3 transition-all duration-300 ${expanded ? 'line-clamp-none' : 'line-clamp-3'} ${winnerCard ? 'text-gray-300' : 'text-gray-600'}`}>
            {meta.detail}
          </p>

          {info && (
            <p className={`text-[10px] tracking-wider uppercase mb-3 ${winnerCard ? 'text-gray-400' : 'text-gray-500'}`}>
              pays {info.pay_count} · holds {info.held_count} · batch {info.batch_size === 0 ? '-' : info.batch_size}
            </p>
          )}

          <div className="flex items-center gap-1.5 mb-2">
            {['CLONE', 'APPLY', 'CHECK'].map((stepName, i) => {
              const isCurrentStep = isActive && stage === i;
              const isPastStep = stage > i;
              let pipStyle = 'bg-gray-200';
              if (winnerCard) pipStyle = 'bg-emerald-500 shadow-[0_0_8px_#34d399]';
              else if (isCurrentStep) pipStyle = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
              else if (isPastStep) pipStyle = isReveal ? 'bg-gray-600' : 'bg-ink';
              return (
                <div key={stepName} className="flex-1 flex flex-col items-center">
                  <div className={`h-[3px] w-full mb-1.5 transition-all duration-300 ${pipStyle}`} />
                  <span className={`text-[8px] font-mono tracking-wider transition-opacity duration-300 ${isCurrentStep || winnerCard ? 'opacity-100 font-bold' : 'opacity-50'}`}>{stepName}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`pt-3 mt-4 border-t flex flex-col gap-2 transition-colors duration-500 ${winnerCard ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-bold uppercase tracking-widest">{statusLabel}</span>
            {score !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 border font-bold ${winnerCard ? 'border-emerald-400/30 text-emerald-400 bg-emerald-400/10' : 'border-gray-400 text-gray-600'}`}>
                SCORE: {score}
              </span>
            )}
          </div>

          {score !== undefined && (
            <div className={`h-[3px] w-full ${winnerCard ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className={`h-full transition-all duration-1000 ease-out ${winnerCard ? 'bg-emerald-400' : rejected ? 'bg-coral' : 'bg-ink'}`}
                style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
              />
            </div>
          )}

          {/* HOVER REASONING (Powered by Live AI) */}
          <div className={`grid transition-all duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr] mt-2' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className={`text-[11px] font-sans p-3 border-l-2 leading-relaxed ${winnerCard ? 'bg-black/30 text-emerald-300 border-emerald-400' : 'bg-gray-100 text-gray-700 border-gray-400'}`}>
                
                {/* Visual AI Indicator */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] animate-pulse">✨</span>
                  <strong className="font-mono text-[9px] tracking-widest uppercase opacity-80">
                    Live AI Safety Auditor
                  </strong>
                </div>

                {hoverText || (showResult ? result.reason : 'Waiting for the sandbox result...')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}