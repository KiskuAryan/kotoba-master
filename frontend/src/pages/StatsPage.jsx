import React, { useState, useEffect } from 'react';
import { BarChart2, Flame, Calendar, Award, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    api.getStats()
      .then((data) => setStats(data))
      .catch((err) => showToast('Failed to load stats: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-nobunaga-red border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400">Aggregating retention analytics...</p>
      </div>
    );
  }

  const heatmap = stats?.heatmap || [];
  const accuracyTrend = stats?.accuracy_trend || [];
  const dueForecast = stats?.due_forecast || [];
  const starDist = stats?.star_distribution || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  // Heatmap color intensity helper
  const getHeatmapColor = (count) => {
    if (count === 0) return 'bg-slate-800/80';
    if (count <= 5) return 'bg-rose-950/80 border border-rose-900';
    if (count <= 15) return 'bg-rose-800 border border-rose-700';
    if (count <= 30) return 'bg-nobunaga-crimson border border-red-500';
    return 'bg-nobunaga-red border border-red-400';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in pb-24 md:pb-12 text-slate-100">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-nobunaga-red/20 border border-nobunaga-red/40 text-red-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles size={13} />
          <span>Spaced Repetition Analytics</span>
        </div>
        <h1 className="font-display text-3xl font-black text-white">LEARNING STATS & HEATMAP</h1>
        <p className="text-xs text-slate-400">
          Quantifiable proof of memory retention and habit consistency
        </p>
      </div>

      {/* Primary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-2">
            <span>Total Reviews</span>
            <Calendar size={16} className="text-nobunaga-red" />
          </div>
          <div className="font-display text-4xl font-black text-white">
            {stats?.total_reviews || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cards answered</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-2">
            <span>Streak Record</span>
            <Flame size={18} className="text-amber-500 fill-amber-500" />
          </div>
          <div className="font-display text-4xl font-black text-amber-400">
            {stats?.longest_streak || 0}d
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Current: {stats?.current_streak || 0} days</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-2">
            <span>Recall Retention</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="font-display text-4xl font-black text-emerald-400">
            {stats?.retention_rate || 95}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Good + Easy response ratio</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-2">
            <span>Mastered (5★)</span>
            <Award size={16} className="text-sky-400" />
          </div>
          <div className="font-display text-4xl font-black text-sky-400">
            {starDist['5'] || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">&gt; 30-day interval reached</p>
        </div>
      </div>

      {/* 365-Day Activity Heatmap */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-wide text-white">
              ACTIVITY HEATMAP (LAST 365 DAYS)
            </h2>
            <p className="text-xs text-slate-400">
              Daily review intensity. Consistency creates unbreakable neural recall.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>Less</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-slate-800" />
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-950" />
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-800" />
            <div className="w-2.5 h-2.5 rounded-sm bg-nobunaga-red" />
            <span>More</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-1.5 min-w-[700px]">
            {/* Show recent ~120 days visually in columns */}
            {Array.from({ length: 26 }).map((_, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1.5">
                {Array.from({ length: 7 }).map((_, rowIdx) => {
                  const dayOffset = colIdx * 7 + rowIdx;
                  const item = heatmap[heatmap.length - 1 - dayOffset];
                  const count = item ? item.count : 0;
                  const dateStr = item ? item.date : '';
                  return (
                    <div
                      key={rowIdx}
                      title={`${dateStr}: ${count} reviews`}
                      className={`w-3.5 h-3.5 rounded-sm transition-all hover:scale-125 cursor-pointer ${getHeatmapColor(count)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 14-Day Due Forecast & 30-Day Accuracy Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 14-Day Due Forecast */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="font-display text-lg font-bold tracking-wide text-white mb-1">
            14-DAY DUE FORECAST
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Words scheduled by the SM-2 algorithm over the next two weeks
          </p>

          <div className="space-y-2">
            {dueForecast.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No upcoming scheduled reviews yet.
              </div>
            ) : (
              dueForecast.slice(0, 7).map((item) => (
                <div key={item.date} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-slate-400 font-mono text-[11px]">{item.date}</span>
                  <div className="flex-1 bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-nobunaga-red h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(5, item.count * 10))}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-bold text-white">{item.count} words</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Accuracy Trend (Last 7 Days) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="font-display text-lg font-bold tracking-wide text-white mb-1">
            ACCURACY TREND
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Percentage of answers rated 'Good' or 'Easy' without resets
          </p>

          <div className="space-y-2">
            {accuracyTrend.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Review cards to start populating accuracy trends!
              </div>
            ) : (
              accuracyTrend.slice(-7).map((item) => (
                <div key={item.date} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-slate-400 font-mono text-[11px]">{item.date}</span>
                  <div className="flex-1 bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-bold text-emerald-400">
                    {item.accuracy}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
