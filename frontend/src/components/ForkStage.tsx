import React from 'react';

const SYSTEMS = ['DATABASE', 'PAYMENT', 'CUSTOMER', 'NOTIFICATION', 'SUPPORT'];

function Box({ title, note, dashed, dim }: { title: string; note: string; dashed?: boolean; dim?: boolean }) {
  return (
    <div className={`border border-ink p-4 transition-all duration-700 ${dashed ? 'border-dashed' : ''} ${dim ? 'opacity-30' : 'bg-white'}`}>
      <p className="font-mono text-[10px] tracking-[0.2em] mb-1">{title}</p>
      <p className="font-serif italic text-sm text-gray-600 mb-3">{note}</p>
      <div className="flex flex-wrap gap-1.5">
        {SYSTEMS.map(s => (
          <span key={s} className="font-mono text-[10px] border border-structural px-2 py-0.5">{s}</span>
        ))}
      </div>
    </div>
  );
}

export function ForkStage({ forked, message }: { forked: boolean; message?: string }) {
  return (
    <div className="mb-10 grid grid-cols-[1fr_110px_1fr] items-center">
      <Box title="PRODUCTION" note="Reality. Not touched." />
      <div className="relative h-px mx-2">
        <div className={`absolute inset-0 bg-ink origin-left transition-transform duration-700 ${forked ? 'scale-x-100' : 'scale-x-0'}`} />
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.2em]">FORK</span>
      </div>
      <Box dashed dim={!forked} title="SANDBOX" note={forked ? (message ?? 'A parallel copy of reality.') : 'Waiting for fork…'} />
    </div>
  );
}