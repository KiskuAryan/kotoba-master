import React from 'react';

export function CardSkeleton() {
  return (
    <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/60 animate-pulse flex flex-col gap-4">
      <div className="h-8 bg-slate-700/50 rounded-lg w-1/3"></div>
      <div className="h-20 bg-slate-700/30 rounded-xl w-full"></div>
      <div className="flex gap-2">
        <div className="h-6 bg-slate-700/40 rounded w-16"></div>
        <div className="h-6 bg-slate-700/40 rounded w-24"></div>
      </div>
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="w-full max-w-xl mx-auto h-[440px] bg-slate-800/60 border border-slate-700/50 rounded-3xl p-8 flex flex-col justify-between items-center animate-pulse">
      <div className="w-24 h-6 bg-slate-700/50 rounded-full"></div>
      <div className="w-48 h-32 bg-slate-700/40 rounded-2xl"></div>
      <div className="w-full h-14 bg-slate-700/30 rounded-2xl"></div>
    </div>
  );
}
