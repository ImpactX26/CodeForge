import { useState, useCallback, useRef, useEffect } from 'react';

export type AgentEvent = { type: string; data: any };

const EVENT_TYPES = ['run_started','executing','fork_started','plans_generated','plan_testing','plan_result','committing','committed','error','stream_end'];

export function useAgentStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<number | null>(null);
  const runRef = useRef(0);

  const stop = useCallback(() => {
    esRef.current?.close(); esRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
  }, []);

  useEffect(() => stop, [stop]); // cleanup on unmount

  const startRun = useCallback(async (task: string, mode: 'naive' | 'dry-run') => {
    stop();
    const runId = ++runRef.current;
    setStatus('running');
    setEvents([]);

    const fallback = () => {
      if (runId !== runRef.current) return;
      console.warn('Backend unavailable. Using internal demo simulation.');
      timerRef.current = runInternalSimulation(mode, setEvents, setStatus);
    };

    try {
      const res = await fetch('http://127.0.0.1:4000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, mode }),
      });
      if (!res.ok) throw new Error('Backend not responding');
      const { run_id } = await res.json();
      if (runId !== runRef.current) return; // a newer run replaced this one

      const es = new EventSource(`http://127.0.0.1:4000/run/${run_id}/stream`);
      esRef.current = es;
      let received = false;

      EVENT_TYPES.forEach(type =>
        es.addEventListener(type, (e) => {
          if (runId !== runRef.current) return;
          received = true;
          setEvents(prev => [...prev, { type, data: JSON.parse((e as MessageEvent).data) }]);
          if (type === 'committed' || type === 'stream_end') { setStatus('complete'); es.close(); }
        })
      );

      es.onerror = () => {
        es.close();
        if (!received) fallback(); else setStatus('error');
      };
    } catch {
      fallback();
    }
  }, [stop]);

  return { startRun, events, status };
}

function runInternalSimulation(mode: string, setEvents: any, setStatus: any) {
  const push = (type: string, data: any) => setEvents((prev: any[]) => [...prev, { type, data }]);

  const naive: [string, any][] = [
    ['executing', { message: 'Running DROP TABLE directly on production...' }],
    ['error', { message: 'nightly_report_job crashed — dependency on old_sessions', rows_lost: 48213 }],
  ];
  const dry: [string, any][] = [
    ['fork_started', { message: 'Forking a copy of the database...' }],
    ['plans_generated', { plans: [
      { plan_id: 'A', label: 'Hard delete' },
      { plan_id: 'B', label: 'Archive, then delete in 30 days' },
      { plan_id: 'C', label: 'Soft delete with flag' },
      { plan_id: 'D', label: 'Truncate and rebuild' },
      { plan_id: 'E', label: 'Move to cold storage' },
    ] }],
    ['plan_testing', { plan_id: 'A' }],
    ['plan_result', { plan_id: 'A', status: 'failed', reason: 'nightly_report_job still reads from this table' }],
    ['plan_testing', { plan_id: 'B' }],
    ['plan_result', { plan_id: 'B', status: 'passed', reason: 'No dependencies found. Safe to archive.' }],
    ['plan_testing', { plan_id: 'C' }],
    ['plan_result', { plan_id: 'C', status: 'failed', reason: 'Soft-delete flag breaks the reconciliation query' }],
    ['plan_testing', { plan_id: 'D' }],
    ['plan_result', { plan_id: 'D', status: 'failed', reason: 'Rebuild exceeds the 5-minute maintenance window' }],
    ['plan_testing', { plan_id: 'E' }],
    ['plan_result', { plan_id: 'E', status: 'passed', reason: 'Safe, but retrieval is slower than Path B' }],
    ['committing', { plan_id: 'B', message: 'Applying the winning plan...' }],
    ['committed', { plan_id: 'B', message: 'Done. old_sessions archived, 0 rows lost.' }],
  ];

  const script = mode === 'naive' ? naive : dry;
  let step = 0;
  const id = window.setInterval(() => {
    const [type, data] = script[step++];
    push(type, data);
    if (step >= script.length) { setStatus('complete'); clearInterval(id); }
  }, mode === 'naive' ? 2200 : 1500);
  return id;
}