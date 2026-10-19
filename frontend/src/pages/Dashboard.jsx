import React, { useState, useEffect } from 'react';
import { Flame, BookOpen, Sparkles, Award, ArrowRight, BarChart2, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Dashboard({ onStartReview, onBrowseDecks, onViewStats, openOnboarding }) {
  const { user, settings } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [dueWords, setDueWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [statsData, dueData] = await Promise.all([
          api.getStats(),
          api.getDueReviews({ limit: 100 })
        ]);
        setStats(statsData);
        setDueWords(dueData);
      } catch (err) {
        console.warn('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const dueCount = dueWords.length;
  const dailyGoal = settings?.daily_goal || 20;
  const reviewedToday = stats?.reviewed_today || 0;
  const goalProgress = Math.min(100, Math.round((reviewedToday / dailyGoal) * 100));

  const starDist = stats?.star_distribution || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const totalMasteredWords = Object.values(starDist).reduce((a, b) => a + b, 0);

  const starColors = {
    '1': { label: '1★ New / Learning', bg: 'bg-slate-400', text: 'text-slate-300' },
    '2': { label: '2★ Early Recall', bg: 'bg-amber-400', text: 'text-amber-400' },
    '3': { label: '3★ Solidifying', bg: 'bg-sky-400', text: 'text-sky-400' },
    '4': { label: '4★ Strong Memory', bg: 'bg-indigo-400', text: 'text-indigo-400' },
    '5': { label: '5★ Mastered', bg: 'bg-emerald-400', text: 'text-emerald-400' }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in text-slate-100 pb-24 md:pb-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        {/* Nobunaga red background accent */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-nobunaga-red/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-nobunaga-red/20 border border-nobunaga-red/40 text-red-300 rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Spaced Repetition Headquarters</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-white">
            WELCOME, {user?.username?.toUpperCase() || 'SAMURAI'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-lg">
            Your memory retention schedule is synchronized. The SM-2 engine prioritizes words precisely when your recall strength is challenged.
          </p>
        </div>

        {/* Big Start Review CTA */}
        <div className="flex flex-col items-center sm:items-end w-full md:w-auto">
          <button
            onClick={onStartReview}
            className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-display text-lg tracking-wider uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${
              dueCount > 0
                ? 'bg-nobunaga-red hover:bg-nobunaga-crimson text-white shadow-nobunaga-red/30 hover:scale-105 active:scale-95'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <BookOpen size={20} />
            <span>{dueCount > 0 ? `Review Due (${dueCount})` : 'Practice Ahead'}</span>
            <ArrowRight size={18} />
          </button>
          {dueCount === 0 && (
            <span className="text-[11px] text-emerald-400 font-medium mt-2 flex items-center gap-1">
              <CheckCircle2 size={13} />
              All scheduled cards reviewed!
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Due Count */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Due Today</span>
            <Clock size={16} className="text-nobunaga-red" />
          </div>
          <div className="font-display text-4xl font-black text-white">{dueCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Words waiting for SM-2 recall</p>
        </div>

        {/* Streak Flame */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Current Streak</span>
            <Flame size={18} className="text-amber-500 fill-amber-500 animate-pulse" />
          </div>
          <div className="font-display text-4xl font-black text-amber-400">
            {stats?.current_streak || user?.streak_days || 0}
            <span className="text-xl font-sans text-slate-500 ml-1">days</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Best streak: {stats?.longest_streak || 0} days
          </p>
        </div>

        {/* Daily Goal Tracker */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Daily Goal</span>
            <Award size={16} className="text-sky-400" />
          </div>
          <div className="font-display text-4xl font-black text-sky-400">
            {reviewedToday}
            <span className="text-xl font-sans text-slate-500 ml-1">/ {dailyGoal}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-sky-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
        </div>

        {/* Retention Accuracy */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Accuracy Rate</span>
            <BarChart2 size={16} className="text-emerald-400" />
          </div>
          <div className="font-display text-4xl font-black text-emerald-400">
            {stats?.retention_rate || 95}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Overall memory retention</p>
        </div>
      </div>

      {/* 5-Star Visual Mastery Distribution */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide text-white">
              5-STAR MASTERY DISTRIBUTION
            </h2>
            <p className="text-xs text-slate-400">
              Derived from SM-2 repetitions & recall intervals (Total words studied: {totalMasteredWords})
            </p>
          </div>
          <button
            onClick={onViewStats}
            className="text-xs font-bold text-nobunaga-red hover:underline flex items-center gap-1"
          >
            <span>View Full Heatmap & Trends</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-4 bg-slate-800 rounded-xl overflow-hidden flex mb-6 shadow-inner">
          {Object.entries(starDist).map(([star, count]) => {
            const width = totalMasteredWords > 0 ? (count / totalMasteredWords) * 100 : 20;
            return (
              <div
                key={star}
                style={{ width: `${width}%` }}
                className={`${starColors[star].bg} h-full transition-all duration-500 hover:opacity-80`}
                title={`${star}★: ${count} words (${Math.round(width)}%)`}
              />
            );
          })}
        </div>

        {/* Breakdown Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(starDist).map(([star, count]) => (
            <div key={star} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className={`text-sm font-bold ${starColors[star].text}`}>{'★'.repeat(Number(star))}</span>
              </div>
              <div className="font-display text-2xl font-black text-white">{count}</div>
              <div className="text-[10px] text-slate-400">{starColors[star].label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mascot Tip & Deck Explorer CTA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Mascot Note */}
        <div className="md:col-span-2 bg-notebook-paper border-2 border-slate-800 rounded-3xl p-5 bg-notebook-grid text-slate-800 flex items-center gap-4 shadow-md">
          <div className="text-4xl p-2 bg-notebook-yellow rounded-2xl border-2 border-slate-800 shrink-0">
            🦊
          </div>
          <div className="text-xs space-y-1">
            <span className="font-bold text-nobunaga-red uppercase tracking-wider text-[10px]">
              Fumayo Spaced-Repetition Tip
            </span>
            <p className="font-medium text-slate-700 leading-relaxed">
              When encountering difficult vocabulary, don't worry about hitting <strong>Again (1d)</strong>. The SM-2 algorithm uses your misses to calibrate tighter repetition intervals so the word solidifies in long-term memory!
            </p>
          </div>
        </div>

        {/* Quick Explore Decks */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-md">
          <div>
            <h3 className="font-display text-lg font-bold text-white mb-1">Need More Words?</h3>
            <p className="text-xs text-slate-400">
              Browse 14 curated JLPT N5 & N4 decks categorized by life themes.
            </p>
          </div>
          <button
            onClick={onBrowseDecks}
            className="mt-4 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2"
          >
            <BookOpen size={14} />
            <span>Browse Themed Decks</span>
          </button>
        </div>
      </div>
    </div>
  );
}
