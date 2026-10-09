import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { AgentEvent, Winner } from '../lib/plans';

export function useAgentStream(apiBaseUrl?: string) {
  const baseUrl: string =
    apiBaseUrl || (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  const sinceRef = useRef(0);
  const epochRef = useRef(-1);   // which backend run we are following
  const busyRef = useRef(false); // never let two polls overlap

  const pollEvents = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await fetch(
        `${baseUrl}/api/events?since=${sinceRef.current}&epoch=${epochRef.current}`
      );
      const data = await res.json();
      epochRef.current = data.epoch;
      sinceRef.current = data.next_index;
      if (data.reset) {
        // Backend started a new run (or we just connected): replace everything.
        setEvents(data.events || []);
      } else if (data.events && data.events.length > 0) {
        setEvents(prev => [...prev, ...data.events]);
      }
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      busyRef.current = false;
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(pollEvents, 400);
    return () => clearInterval(interval);
  }, [isPolling, pollEvents]);

  const executeAction = async (endpoint: string, payload?: any) => {
    try {
      const res = await fetch(`${baseUrl}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      return await res.json();
    } catch (err) {
      console.error(`Action ${endpoint} failed:`, err);
      return { error: String(err) };
    }
  };

  const startRun = async (command: string, numInvoices: number = 40) => {
    setIsPolling(false);
    setEvents([]);
    sinceRef.current = 0;
    epochRef.current = -1;

    await executeAction('reset', { num_invoices: numInvoices });
    await executeAction('run', { command });

    // Start listening only AFTER the backend run exists, so no event is missed.
    setIsPolling(true);
  };

  // The winner is always derived from the latest comparison_ready event.
  const winner: Winner | null = useMemo(() => {
    const c = [...events].reverse().find(e => e.event === 'comparison_ready');
    if (!c || !c.data) return null;
    const w = (c.data.results || []).find((r: any) => r.plan_id === c.data.winner_id);
    if (!w || !w.expanded_plan) return null;
    return { plan: w.expanded_plan, cert: c.data.cert, token: c.data.token };
  }, [events]);

  return {
    events,
    winner,
    startRun,
    executeAction,
    isPolling,
    stopPolling: () => setIsPolling(false),
  };
}