import React, { useState, useEffect } from 'react';
import { TimelineGuide } from '../components/TimelineGuide';

export function LandingPage({ 
  onTransitionToDryRun, 
  apiBaseUrl 
}: { 
  onTransitionToDryRun: (task: string, numInvoices: number) => void; 
  apiBaseUrl: string; 
}) {
  const [task, setTask] = useState("Clear all pending vendor invoices due this week");
  const [txCount, setTxCount] = useState<number>(100); // Default to 100 dynamic transactions

  const handleLaunch = () => {
    onTransitionToDryRun(task, txCount);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Prevent triggering if typing in either input field
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        handleLaunch();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [task, txCount]);

  return (
    <div className="bg-bgCanvas text-ink min-h-screen flex font-sans selection:bg-structural">
      <TimelineGuide activeStages={1} />
      
      <div className="max-w-5xl pt-24 pl-16 pr-12 w-full relative">
        <p className="text-xs tracking-[0.25em] text-gray-500 uppercase mb-4 font-mono">
          Cryptographic Sandboxing · Ed25519 · Zero Live Blast Radius
        </p>
        <h1 className="text-7xl font-serif mb-6 tracking-tight">Dry-Run Agent</h1>
        <p className="text-xl text-gray-600 mb-12 font-serif max-w-2xl leading-relaxed">
          The agent does not touch production directly. It proposes abstract intents, forks ephemeral SQLite sandboxes in parallel, proves safety through Ed25519 certificates, and halts if live reality drifts.
        </p>

        {/* Core Architecture Pillars */}
        <div className="grid grid-cols-3 gap-6 mb-16 border-y border-structural py-6 font-mono text-xs">
          <div className="pr-4">
            <span className="text-gray-400 block mb-1">01 / PROPOSE ONLY</span>
            <p className="text-gray-700 font-sans text-sm">AI never writes raw SQL. It outputs parameter bounds.</p>
          </div>
          <div className="border-l border-structural pl-6 pr-4">
            <span className="text-gray-400 block mb-1">02 / PARALLEL SANDBOX</span>
            <p className="text-gray-700 font-sans text-sm">6 worker threads simulate candidate futures concurrently.</p>
          </div>
          <div className="border-l border-structural pl-6">
            <span className="text-gray-400 block mb-1">03 / DRIFT PROOF</span>
            <p className="text-gray-700 font-sans text-sm">Tokens bind state hashes. Live mutation aborts execution.</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_200px] gap-8 mb-6">
          <div>
            <p className="font-mono text-xs tracking-widest text-gray-500 uppercase mb-2">TARGET MISSION DIRECTIVE</p>
            <input 
              type="text" 
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full bg-transparent border-b-2 border-ink text-3xl font-serif py-3 outline-none"
            />
          </div>
          <div>
            <p className="font-mono text-xs tracking-widest text-gray-500 uppercase mb-2">TRANSACTIONS</p>
            <input 
              type="number" 
              value={txCount}
              onChange={(e) => setTxCount(Number(e.target.value))}
              min="10"
              max="5000"
              className="w-full bg-transparent border-b-2 border-coral text-3xl font-serif py-3 outline-none text-coral text-center"
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-sm font-mono tracking-wide mt-8">
          <span className="text-xs text-gray-400">
            Procedurally generating {txCount} invoices with injected chaos vectors...
          </span>
          <button 
            onClick={handleLaunch}
            className="px-8 py-3 border border-ink bg-ink text-bgCanvas hover:bg-transparent hover:text-ink transition-colors cursor-pointer"
          >
            INITIALIZE RUN [SPACE] →
          </button>
        </div>
      </div>
    </div>
  );
}