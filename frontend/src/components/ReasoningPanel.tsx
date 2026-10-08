import React from 'react';

type PlanResultEvent = {
  plan_id: string;
  status: "passed" | "failed";
  reason: string;
};

interface ReasoningPanelProps {
  winningPlanId: string;
  results: PlanResultEvent[];
}

export function ReasoningPanel({ winningPlanId, results }: ReasoningPanelProps) {
  // Find the winning plan's exact event payload to extract the plain-English reason[cite: 7]
  const winningResult = results.find(r => r.plan_id === winningPlanId);

  if (!winningResult) return null;

  return (
    <div className="bg-white border border-[#D8D4CB] p-8 mb-16 shadow-sm">
      <h3 className="font-serif text-2xl mb-4 text-[#1A1A1A]">
        Why Plan {winningPlanId} Won
      </h3>
      
      <div className="flex justify-between items-start gap-8">
        <div className="space-y-4 flex-1">
          {/* Render the plain-English string directly from the contract[cite: 5, 7] */}
          <p className="text-lg font-serif italic text-gray-700 leading-relaxed border-l-2 border-[#1A1A1A] pl-4">
            "{winningResult.reason}"
          </p>
          
          <div className="space-y-2 mt-6 font-mono text-sm">
            {['Transaction recovered', 'No data loss', 'No duplicate operation', 'No human intervention', 'Lowest operational risk'].map(t => (
              <div key={t} className="flex gap-3"><span>✓</span><span>{t}</span></div>
            ))}
          </div>
        </div>
        
        <div className="text-right border-l border-[#D8D4CB] pl-8">
          <div className="text-xs tracking-[0.2em] text-gray-500 uppercase mb-2">Verdict</div>
          <div className="text-4xl font-serif text-[#1A1A1A] uppercase tracking-tight">
            {winningResult.status}
          </div>
        </div>
      </div>
    </div>
  );
}