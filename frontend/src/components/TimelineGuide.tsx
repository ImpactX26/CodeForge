// src/components/TimelineGuide.tsx
import React from 'react';
export function TimelineGuide({ activeStages = 1 }: { activeStages?: number }) {
  const nodes = Array.from({ length: 8 });
  return (
    <div className="w-16 border-r border-structural flex flex-col items-center py-24 space-y-8 shrink-0">
      <div className="-rotate-90 text-[10px] tracking-[0.2em] text-gray-400 font-sans w-32 text-center mb-16">
        STAGE TIMELINE
      </div>
      {nodes.map((_, i) => (
        <div 
          key={i} 
          className={`w-2.5 h-2.5 rounded-full ${i < activeStages ? 'bg-ink' : 'border border-ink bg-transparent'}`} 
        />
      ))}
    </div>
  );
}