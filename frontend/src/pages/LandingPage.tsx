import React, { useState, useEffect } from 'react';
import { useAgentStream } from '../hooks/useAgentStream';
import { TimelineGuide } from '../components/TimelineGuide';

export function LandingPage({ 
  onTransitionToDryRun, 
  apiBaseUrl 
}: { 
  onTransitionToDryRun: (task: string) => void; 
  apiBaseUrl: string; 
}) {
  const [task, setTask] = useState("Process 1,200 failed refunds across stripe_prod");
  const [mode, setMode] = useState<'naive' | 'dry-run'>('naive');
  const { startRun, events, status } = useAgentStream();

  // The main trigger for both button click and Spacebar
  const handleExecute = () => {
    if (mode === 'dry-run') {
      onTransitionToDryRun(task);
    } else {
      startRun(task, 'naive');
    }
  };

  // Global listener for the physical Spacebar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        handleExecute();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, task, startRun, onTransitionToDryRun]);

  const naiveErrorEvent = events.find(e => e.type === 'error');
  const naiveExecutingEvent = events.find(e => e.type === 'executing');
  
  // Detects if the fetch failed completely (e.g., mock server is offline)
  const isConnectionError = status === 'error' && events.length === 0;

  return (
    <div className="bg-bgCanvas text-ink min-h-screen flex font-sans selection:bg-structural">
      <TimelineGuide activeStages={status === 'running' ? 2 : 1} />
      
      <div className="max-w-4xl pt-32 pl-16 w-full relative">
        <p className="text-xs tracking-[0.2em] text-gray-500 uppercase mb-6">Simulate before you act.</p>
        <h1 className="text-8xl font-serif mb-6 tracking-tight">Dry-Run Agent</h1>
        <p className="text-xl text-gray-600 mb-24 font-serif max-w-2xl">
          The agent doesn't blindly act. It explores the consequences, rejects bad futures, and executes the safest one.
        </p>

        <div className="relative">
          <input 
            type="text" 
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            className="w-full bg-transparent border-b-2 border-ink text-4xl font-serif py-4 outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex justify-between items-center mt-8 text-sm font-mono tracking-wide">
          <div className="flex gap-6">
            <span className="text-gray-400">MODE:</span>
            <button 
              onClick={() => setMode('naive')}
              className={`${mode === 'naive' ? 'border-b border-ink text-ink' : 'text-gray-400'}`}
            >
              NAIVE
            </button>
            <span className="text-gray-400">/</span>
            <button 
              onClick={() => setMode('dry-run')}
              className={`${mode === 'dry-run' ? 'border-b border-ink text-ink' : 'text-gray-400'}`}
            >
              DRY-RUN
            </button>
          </div>
          
          <button 
            onClick={handleExecute}
            className="px-6 py-2 border border-ink hover:bg-ink hover:text-bgCanvas transition-colors cursor-pointer"
          >
            [SPACE] NEXT
          </button>
        </div>

        {/* Backend Connection Warning */}
        {isConnectionError && (
          <div className="mt-12 text-coral font-mono text-sm border border-coral p-4 bg-coral/10">
            ⚠️ Connection Refused: The backend is offline. Start the mock server on port 4000.
          </div>
        )}

        {/* Naive Execution Overlay */}
        {status !== 'idle' && mode === 'naive' && !isConnectionError && (
          <div className="mt-16 border-l-2 border-ink pl-8 py-4 animate-fade-in">
            {naiveExecutingEvent && (
              <p className="font-mono text-gray-600 mb-4 animate-pulse">
                {naiveExecutingEvent.data.message}
              </p>
            )}
            
            {naiveErrorEvent && (
              <div className="bg-coral/10 border border-coral p-6 text-coral">
                <h3 className="font-serif text-3xl mb-2">FAILURE DETECTED</h3>
                <p className="font-mono mb-4">{naiveErrorEvent.data.message}</p>
                <div className="text-6xl font-serif">{naiveErrorEvent.data.rows_lost} <span className="text-xl">ROWS LOST</span></div>
                <p className="mt-6 text-ink italic opacity-80">The agent acted before knowing the consequences.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}