import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Volume2, ChevronRight, Award, Flame, RotateCcw, CheckCircle, ArrowLeft, Sparkles, BookOpen } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { speakJapanese } from '../utils/audio';

export default function ReviewSession({ onBackToDashboard, onBrowseDecks }) {
  const { user, settings, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Load due reviews
  const loadDueReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDueReviews({ limit: settings?.daily_goal || 25 });
      setQueue(data);
      setCurrentIndex(0);
      setFlipped(false);
      setSessionLogs([]);
      setSessionCompleted(false);
      setStartTime(Date.now());
    } catch (err) {
      showToast('Failed to load reviews: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [settings?.daily_goal, showToast]);

  useEffect(() => {
    loadDueReviews();
  }, [loadDueReviews]);

  const currentCard = queue[currentIndex];

  // Auto-play audio if enabled
  useEffect(() => {
    if (flipped && settings?.audio_autoplay && currentCard) {
      speakJapanese(currentCard.kana || currentCard.kanji);
    }
  }, [flipped, settings?.audio_autoplay, currentCard]);

  // Handle rating submission
  const handleRate = async (rating) => {
    if (!currentCard || submitting) return;
    setSubmitting(true);
    const responseTime = Date.now() - startTime;

    try {
      const result = await api.submitReview(currentCard.id, rating, responseTime);

      const logEntry = {
        word: currentCard,
        rating,
        oldStars: currentCard.stars,
        newStars: result.stars,
        nextDue: result.next_review_due
      };

      const nextLogs = [...sessionLogs, logEntry];
      setSessionLogs(nextLogs);

      if (currentIndex + 1 < queue.length) {
        setCurrentIndex((prev) => prev + 1);
        setFlipped(false);
        setStartTime(Date.now());
      } else {
        // Session Complete!
        setSessionCompleted(true);
        refreshUser();
        // Fire confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}
      }
    } catch (err) {
      showToast('Error recording review: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (sessionCompleted || !currentCard) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && !submitting) {
        if (e.key === '1') handleRate('again');
        else if (e.key === '2') handleRate('hard');
        else if (e.key === '3') handleRate('good');
        else if (e.key === '4') handleRate('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipped, submitting, sessionCompleted, currentCard]);

  // Star color mapping helper
  const getStarColorBand = (stars) => {
    switch (stars) {
      case 5: return 'bg-emerald-500 shadow-emerald-500/50';
      case 4: return 'bg-indigo-500 shadow-indigo-500/50';
      case 3: return 'bg-sky-500 shadow-sky-500/50';
      case 2: return 'bg-amber-500 shadow-amber-500/50';
      default: return 'bg-slate-500 shadow-slate-500/50';
    }
  };

  // 1. LOADING STATE
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-nobunaga-red border-t-transparent animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm">Preparing your review deck...</p>
      </div>
    );
  }

  // 2. EMPTY STATE: NO REVIEWS DUE
  if (queue.length === 0 && !sessionCompleted) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-notebook-paper border-4 border-slate-800 rounded-3xl p-8 bg-notebook-grid text-slate-800 text-center shadow-xl">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-notebook-yellow border-2 border-slate-800 flex items-center justify-center text-4xl mb-4 rotate-3 shadow-md">
            🎉
          </div>
          <div className="inline-block px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-black uppercase tracking-wider mb-2">
            All Caught Up!
          </div>
          <h2 className="font-display text-3xl font-black text-slate-900 mb-2">
            No Cards Due Right Now!
          </h2>
          <p className="text-xs text-slate-600 mb-6 font-medium leading-relaxed">
            Great job! You have completed all scheduled spaced-repetition reviews for today. The SM-2 algorithm will schedule your next batch when memories need refreshing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onBrowseDecks}
              className="flex-1 py-3 px-4 bg-nobunaga-red text-white font-display text-xs tracking-wider uppercase rounded-xl hover:bg-nobunaga-crimson transition-all flex items-center justify-center gap-2 shadow-md shadow-nobunaga-red/30"
            >
              <BookOpen size={16} />
              <span>Explore More Decks</span>
            </button>
            <button
              onClick={onBackToDashboard}
              className="py-3 px-4 bg-slate-200 text-slate-800 font-display text-xs tracking-wider uppercase rounded-xl hover:bg-slate-300 transition-all"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. SESSION SUMMARY SCREEN (Oda Nobunaga Victory Banner)
  if (sessionCompleted) {
    const total = sessionLogs.length;
    const againCount = sessionLogs.filter((l) => l.rating === 'again').length;
    const hardCount = sessionLogs.filter((l) => l.rating === 'hard').length;
    const goodCount = sessionLogs.filter((l) => l.rating === 'good').length;
    const easyCount = sessionLogs.filter((l) => l.rating === 'easy').length;
    const accuracy = total > 0 ? Math.round(((goodCount + easyCount) / total) * 100) : 100;

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-nobunaga-cream border-4 border-nobunaga-dark rounded-3xl p-6 sm:p-10 shadow-2xl text-nobunaga-dark relative overflow-hidden">
          {/* Decorative vertical badge */}
          <div className="absolute top-4 right-4 hidden sm:block">
            <div className="writing-vertical-rl text-[11px] font-bold text-nobunaga-red tracking-[0.3em] uppercase">
              天下統一 • 記憶達成
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-nobunaga-red text-white flex items-center justify-center text-3xl font-display font-black rounded-2xl shadow-lg shadow-nobunaga-red/30">
              勝
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nobunaga-red text-white text-[10px] font-bold uppercase tracking-wider rounded">
                <Sparkles size={12} />
                <span>Session Complete</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-black text-nobunaga-dark">
                VICTORY IN VOCABULARY
              </h2>
            </div>
          </div>

          <p className="text-slate-700 text-sm font-medium mb-8">
            You successfully reviewed <strong className="text-nobunaga-red font-bold">{total} words</strong>. Your retention intervals have been recalculated according to the SM-2 algorithm.
          </p>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-white border-2 border-nobunaga-dark/30 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500">Total Cards</div>
              <div className="font-display text-3xl font-black text-nobunaga-dark">{total}</div>
            </div>
            <div className="bg-white border-2 border-nobunaga-dark/30 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500">Recall Rate</div>
              <div className="font-display text-3xl font-black text-emerald-600">{accuracy}%</div>
            </div>
            <div className="bg-white border-2 border-nobunaga-dark/30 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500">Current Streak</div>
              <div className="font-display text-3xl font-black text-amber-500 flex items-center justify-center gap-1">
                <Flame size={20} className="fill-amber-500 text-amber-500" />
                <span>{user?.streak_days || 1}d</span>
              </div>
            </div>
            <div className="bg-white border-2 border-nobunaga-dark/30 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500">Easy Hits</div>
              <div className="font-display text-3xl font-black text-indigo-600">{easyCount}</div>
            </div>
          </div>

          {/* Breakdown Pills */}
          <div className="bg-white border border-nobunaga-dark/20 p-4 rounded-2xl mb-8 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600">Response Breakdown:</span>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg">Again: {againCount}</span>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg">Hard: {hardCount}</span>
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg">Good: {goodCount}</span>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg">Easy: {easyCount}</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onBackToDashboard}
              className="flex-1 py-4 bg-nobunaga-red hover:bg-nobunaga-crimson text-white font-display text-sm tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-nobunaga-red/30 flex items-center justify-center gap-2"
            >
              <span>Back to Dashboard</span>
              <ChevronRight size={18} />
            </button>
            <button
              onClick={loadDueReviews}
              className="py-4 px-6 border-2 border-nobunaga-dark hover:bg-nobunaga-dark hover:text-white font-display text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              <span>Review Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. ACTIVE REVIEW SESSION (Calm, distraction-free screen)
  const progressPercent = Math.round(((currentIndex) / queue.length) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col justify-between min-h-[calc(100vh-5rem)]">
      {/* Top Header & Progress */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
          <div className="flex items-center gap-2 font-mono font-bold">
            <span className="text-slate-200">{currentIndex + 1}</span>
            <span>/</span>
            <span>{queue.length}</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {currentCard.level || 'JLPT'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-nobunaga-red transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3D Calm Flashcard Container */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="w-full h-[380px] sm:h-[420px] perspective-1000 cursor-pointer select-none my-auto"
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d shadow-2xl rounded-3xl ${
            flipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT OF CARD (Clean, calm, massive kanji) */}
          <div className="absolute inset-0 backface-hidden bg-slate-900 border border-slate-700/80 rounded-3xl p-8 flex flex-col justify-between items-center text-slate-100 shadow-xl bg-paper-texture">
            {/* Star color band at top */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStarColorBand(currentCard.stars)}`} />
                <span className="text-xs font-semibold text-slate-400">
                  {currentCard.stars}★ Level
                </span>
              </div>
              <div className="flex text-amber-400 text-sm">
                {'★'.repeat(currentCard.stars)}
                <span className="text-slate-600">{'★'.repeat(5 - currentCard.stars)}</span>
              </div>
            </div>

            {/* Huge Kanji Display */}
            <div className="text-center my-auto flex flex-col items-center gap-4">
              <div className="font-kanji text-7xl sm:text-8xl font-bold tracking-tight text-white hover:scale-105 transition-transform">
                {currentCard.kanji}
              </div>

              {/* Pronunciation Audio Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speakJapanese(currentCard.kana || currentCard.kanji);
                }}
                className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700 shadow-md"
                title="Hear Pronunciation (Voice)"
              >
                <Volume2 size={22} />
              </button>
            </div>

            {/* Instruction pill */}
            <div className="text-xs text-slate-400 font-medium bg-slate-800/60 px-4 py-2 rounded-xl border border-slate-700/60 flex items-center gap-2">
              <span>Press Space or tap to flip</span>
            </div>
          </div>

          {/* BACK OF CARD (Complete breakdown, meaning, mnemonic, example) */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 flex flex-col justify-between text-slate-100 shadow-xl overflow-y-auto bg-paper-texture">
            <div>
              {/* Header with audio */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStarColorBand(currentCard.stars)}`} />
                  <span className="text-xs font-bold text-slate-400">
                    Next interval: {currentCard.interval_days || 1}d
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    speakJapanese(currentCard.kana || currentCard.kanji);
                  }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                >
                  <Volume2 size={18} />
                </button>
              </div>

              {/* Japanese readings */}
              <div className="flex flex-wrap items-baseline gap-3 mb-2">
                <span className="font-kanji text-4xl font-bold text-white">{currentCard.kanji}</span>
                <span className="text-2xl text-amber-300 font-medium">{currentCard.kana}</span>
                <span className="text-xs text-slate-400 font-mono">[{currentCard.romaji}]</span>
              </div>

              {/* English Meaning */}
              <h3 className="text-xl font-bold text-slate-100 mb-3">{currentCard.meaning}</h3>

              {/* Example Sentence */}
              {currentCard.example_sentence && (
                <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-xs mb-3 space-y-1">
                  <p className="font-kanji text-sm text-slate-200">{currentCard.example_sentence}</p>
                  <p className="text-slate-400 italic">{currentCard.example_translation}</p>
                </div>
              )}

              {/* Mnemonic */}
              {currentCard.mnemonic && (
                <div className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                  <span className="font-bold text-amber-400">Mnemonic: </span>
                  {currentCard.mnemonic}
                </div>
              )}
            </div>

            <div className="text-[11px] text-center text-slate-400 pt-2 border-t border-slate-800">
              Rate your recall below to schedule next review
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Rating Controls (Optimized for one-handed mobile reach) */}
      <div className="pt-4 pb-2">
        {!flipped ? (
          <button
            onClick={() => setFlipped(true)}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-white font-display text-sm tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>Show Answer (Space)</span>
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <button
              disabled={submitting}
              onClick={() => handleRate('again')}
              className="py-3 px-1 sm:px-2 rounded-2xl bg-red-950/70 hover:bg-red-900 border border-red-700 text-red-200 flex flex-col items-center justify-center transition-all active:scale-95 shadow-md"
            >
              <span className="font-display text-xs sm:text-sm font-bold uppercase">Again</span>
              <span className="text-[10px] text-red-400 mt-0.5">&lt; 1d (1)</span>
            </button>

            <button
              disabled={submitting}
              onClick={() => handleRate('hard')}
              className="py-3 px-1 sm:px-2 rounded-2xl bg-amber-950/70 hover:bg-amber-900 border border-amber-700 text-amber-200 flex flex-col items-center justify-center transition-all active:scale-95 shadow-md"
            >
              <span className="font-display text-xs sm:text-sm font-bold uppercase">Hard</span>
              <span className="text-[10px] text-amber-400 mt-0.5">Slow (2)</span>
            </button>

            <button
              disabled={submitting}
              onClick={() => handleRate('good')}
              className="py-3 px-1 sm:px-2 rounded-2xl bg-blue-950/70 hover:bg-blue-900 border border-blue-700 text-blue-200 flex flex-col items-center justify-center transition-all active:scale-95 shadow-md"
            >
              <span className="font-display text-xs sm:text-sm font-bold uppercase">Good</span>
              <span className="text-[10px] text-blue-400 mt-0.5">Optimal (3)</span>
            </button>

            <button
              disabled={submitting}
              onClick={() => handleRate('easy')}
              className="py-3 px-1 sm:px-2 rounded-2xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 flex flex-col items-center justify-center transition-all active:scale-95 shadow-md"
            >
              <span className="font-display text-xs sm:text-sm font-bold uppercase">Easy</span>
              <span className="text-[10px] text-emerald-400 mt-0.5">Instant (4)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
