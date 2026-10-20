import React, { useState, useEffect, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Volume2, ChevronRight, Flame, RotateCcw, CheckCircle, XCircle, ArrowLeft, Sparkles, BookOpen, Check, X, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { speakJapanese } from '../utils/audio';

export default function ReviewSession({ onBackToDashboard, onBrowseDecks }) {
  const { user, settings, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // MCQ state for current card
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const [sessionLogs, setSessionLogs] = useState([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Load due reviews
  const loadDueReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDueReviews({ limit: settings?.daily_goal || 25 });
      const cards = Array.isArray(data) ? data : (data?.cards || []);
      setQueue(cards);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswered(false);
      setIsCorrect(false);
      setLastResult(null);
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

  // Auto-play audio on new card if audio_autoplay is enabled
  useEffect(() => {
    if (!currentCard || answered || !settings?.audio_autoplay) return;
    speakJapanese(currentCard.kana || currentCard.kanji);
  }, [currentIndex, currentCard, settings?.audio_autoplay]);

  // Ensure current card always has 4 options
  const options = useMemo(() => {
    if (!currentCard) return [];
    if (Array.isArray(currentCard.options) && currentCard.options.length >= 2) {
      return currentCard.options;
    }
    // Fallback: collect meanings from other cards in the queue
    const correctMeaning = currentCard.meaning;
    const others = queue
      .filter((c) => c.meaning !== correctMeaning)
      .map((c) => c.meaning);
    const shuffledOthers = [...new Set(others)].sort(() => 0.5 - Math.random()).slice(0, 3);
    const combined = [...shuffledOthers, correctMeaning].sort(() => 0.5 - Math.random());
    return combined;
  }, [currentCard, queue]);

  // Handle MCQ Option Selection
  const handleSelectOption = async (option) => {
    if (answered || submitting || !currentCard) return;

    const responseTime = Date.now() - startTime;
    const correct = option.trim().toLowerCase() === currentCard.meaning.trim().toLowerCase();

    setSelectedOption(option);
    setAnswered(true);
    setIsCorrect(correct);
    setSubmitting(true);

    // Speak pronunciation on answer
    speakJapanese(currentCard.kana || currentCard.kanji);

    try {
      const cardId = currentCard.id || currentCard.word_id;
      const result = await api.submitReview(cardId, {
        selected_option: option,
        is_correct: correct,
        response_time_ms: responseTime
      });

      setLastResult(result);

      const logEntry = {
        word: currentCard,
        selectedOption: option,
        isCorrect: correct,
        oldStars: currentCard.stars ?? currentCard.star_rating ?? 1,
        newStars: result.stars ?? result.newStars ?? result.star_rating_after ?? 1,
        intervalDays: result.interval_days,
        streak: result.streak
      };

      setSessionLogs((prev) => [...prev, logEntry]);

      // If incorrect, queue the card again at the end for reinforcement
      if (!correct) {
        setQueue((prevQueue) => [...prevQueue, { ...currentCard, isRetry: true }]);
      }
    } catch (err) {
      showToast('Error recording review: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Advance to next card
  const handleNext = () => {
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setAnswered(false);
      setIsCorrect(false);
      setLastResult(null);
      setStartTime(Date.now());
    } else {
      // Session Completed!
      setSessionCompleted(true);
      refreshUser();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  };

  // Keyboard shortcut listener (Keys 1-4 for options, Space/Enter for Next)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (sessionCompleted || !currentCard) return;

      if (!answered && !submitting) {
        if (e.key === '1' && options[0]) handleSelectOption(options[0]);
        else if (e.key === '2' && options[1]) handleSelectOption(options[1]);
        else if (e.key === '3' && options[2]) handleSelectOption(options[2]);
        else if (e.key === '4' && options[3]) handleSelectOption(options[3]);
      } else if (answered) {
        if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [answered, submitting, sessionCompleted, currentCard, options]);

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
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-8 text-slate-100 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-4xl mb-4 rotate-3 shadow-md">
            🎉
          </div>
          <div className="inline-block px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-black uppercase tracking-wider mb-2">
            All Caught Up!
          </div>
          <h2 className="font-display text-3xl font-black text-white mb-2">
            No Cards Due Right Now!
          </h2>
          <p className="text-xs text-slate-400 mb-6 font-medium leading-relaxed">
            Great job! You have completed all scheduled spaced-repetition reviews for today. The Anki/SM-2 spaced repetition algorithm will schedule your next batch when memories need reinforcement.
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
              className="py-3 px-4 bg-slate-800 text-slate-300 hover:text-white font-display text-xs tracking-wider uppercase rounded-xl hover:bg-slate-700 transition-all"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. SESSION SUMMARY SCREEN (Victory Banner)
  if (sessionCompleted) {
    const total = sessionLogs.length;
    const correctCount = sessionLogs.filter((l) => l.isCorrect).length;
    const missedCount = total - correctCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-10 shadow-2xl text-slate-100 relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-nobunaga-red text-white flex items-center justify-center text-3xl font-display font-black rounded-2xl shadow-lg shadow-nobunaga-red/30">
              勝
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nobunaga-red text-white text-[10px] font-bold uppercase tracking-wider rounded">
                <Sparkles size={12} />
                <span>Session Complete</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-black text-white">
                REVIEW COMPLETED
              </h2>
            </div>
          </div>

          <p className="text-slate-300 text-sm font-medium mb-8">
            You evaluated <strong className="text-nobunaga-red font-bold">{total} vocabulary items</strong>. Retention intervals and star mastery have been updated according to the SM-2 algorithm.
          </p>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Answered</div>
              <div className="font-display text-3xl font-black text-white">{total}</div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-400">Accuracy</div>
              <div className="font-display text-3xl font-black text-emerald-400">{accuracy}%</div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-400">Correct</div>
              <div className="font-display text-3xl font-black text-emerald-400 flex items-center justify-center gap-1">
                <Check size={20} />
                <span>{correctCount}</span>
              </div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-400">Needs Review</div>
              <div className="font-display text-3xl font-black text-rose-400 flex items-center justify-center gap-1">
                <X size={20} />
                <span>{missedCount}</span>
              </div>
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
              className="py-4 px-6 border border-slate-700 hover:bg-slate-800 text-slate-200 font-display text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              <span>Review Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. ACTIVE MCQ REVIEW CARD
  const progressPercent = Math.round(((currentIndex) / queue.length) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col justify-between min-h-[calc(100vh-5rem)] text-slate-100">
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
            <span className="text-white">{currentIndex + 1}</span>
            <span>/</span>
            <span>{queue.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {currentCard.isRetry && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Reinforcement
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {currentCard.level || currentCard.jlpt_level || 'JLPT'}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-nobunaga-red transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main MCQ Vocab Question Card */}
      <div className="w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col my-auto relative">
        {/* Star & Deck Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStarColorBand(currentCard.stars ?? currentCard.star_rating ?? 1)}`} />
            <span className="text-xs font-semibold text-slate-400">
              {currentCard.stars ?? currentCard.star_rating ?? 1}★ Mastery Level
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {currentCard.deck_name ? `${currentCard.deck_name}` : `Lesson ${currentCard.lesson_number || 1}`}
            </span>
            <div className="flex text-amber-400 text-sm">
              {'★'.repeat(currentCard.stars ?? currentCard.star_rating ?? 1)}
              <span className="text-slate-700">{'★'.repeat(5 - (currentCard.stars ?? currentCard.star_rating ?? 1))}</span>
            </div>
          </div>
        </div>

        {/* Japanese Vocabulary Display (Massive Kanji + Kana + Romaji) */}
        <div className="text-center py-6 flex flex-col items-center gap-3">
          {/* Kanji */}
          <div className="font-kanji text-6xl sm:text-7xl font-bold tracking-tight text-white">
            {currentCard.kanji || currentCard.kana}
          </div>

          {/* Kana & Romaji Display */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {currentCard.kanji && (
              <span className="text-2xl text-amber-300 font-medium">
                {currentCard.kana}
              </span>
            )}

            {/* Romaji (prominently shown alongside Japanese) */}
            {currentCard.romaji && (
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-sm text-sky-300 font-semibold tracking-wide">
                [{currentCard.romaji}]
              </span>
            )}

            {/* Pronunciation Audio Button */}
            <button
              onClick={() => speakJapanese(currentCard.kana || currentCard.kanji)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition-colors border border-slate-700 shadow-sm ml-1"
              title="Hear Pronunciation"
            >
              <Volume2 size={18} />
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            {!answered ? 'Choose the correct English meaning below (or press 1–4):' : 'Spaced repetition recall evaluated:'}
          </p>
        </div>

        {/* 4 Multiple Choice Options (MCQ) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 pb-4">
          {options.map((opt, idx) => {
            const isTarget = opt.trim().toLowerCase() === currentCard.meaning.trim().toLowerCase();
            const isUserPick = selectedOption === opt;

            let buttonStyle = 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-100 hover:border-slate-500';

            if (answered) {
              if (isTarget) {
                // Correct answer always glows green
                buttonStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/20';
              } else if (isUserPick) {
                // User picked wrong option turns red
                buttonStyle = 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-lg shadow-rose-500/20';
              } else {
                // Other options fade out
                buttonStyle = 'bg-slate-800/30 border-slate-800/60 text-slate-500 opacity-40';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={answered || submitting}
                onClick={() => handleSelectOption(opt)}
                className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex items-center justify-between group ${buttonStyle} ${
                  !answered ? 'active:scale-[0.98]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                    answered && isTarget
                      ? 'bg-emerald-500 text-white'
                      : answered && isUserPick
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-700/80 text-slate-300 group-hover:bg-slate-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold leading-snug">{opt}</span>
                </div>

                {answered && isTarget && (
                  <CheckCircle size={18} className="text-emerald-400 shrink-0 ml-2" />
                )}
                {answered && isUserPick && !isTarget && (
                  <XCircle size={18} className="text-rose-400 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Revealed Context & SM-2 Feedback After Answering */}
        {answered && (
          <div className="mt-3 pt-4 border-t border-slate-800 space-y-3 animate-fade-in">
            {/* Feedback Banner */}
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
              isCorrect
                ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                : 'bg-rose-950/60 border-rose-600/50 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span className="font-bold">
                  {isCorrect ? 'Correct! SM-2 interval expanded.' : 'Incorrect. Scheduled for recall reinforcement.'}
                </span>
              </div>
              {lastResult && (
                <span className="font-mono text-[11px] font-semibold text-slate-300">
                  Next due: {lastResult.interval_days || 1}d
                </span>
              )}
            </div>

            {/* Example sentence & mnemonic */}
            {(currentCard.example_sentence || currentCard.example_ja || currentCard.mnemonic) && (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-xs space-y-2">
                {(currentCard.example_sentence || currentCard.example_ja) && (
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider text-[10px]">Example Sentence</span>
                      <button
                        onClick={() => speakJapanese(currentCard.example_sentence || currentCard.example_ja)}
                        className="text-amber-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <Volume2 size={12} />
                        <span>Listen</span>
                      </button>
                    </div>
                    <p className="font-kanji text-sm text-slate-200">
                      {currentCard.example_sentence || currentCard.example_ja}
                    </p>
                    <p className="text-slate-400 italic mt-0.5">
                      {currentCard.example_translation || currentCard.example_en}
                    </p>
                  </div>
                )}

                {currentCard.mnemonic && (
                  <div className="pt-2 border-t border-slate-700/40 text-amber-200/90">
                    <span className="font-bold text-amber-400">Mnemonic: </span>
                    {currentCard.mnemonic}
                  </div>
                )}
              </div>
            )}

            {/* Next Card Button */}
            <button
              onClick={handleNext}
              className="w-full py-3.5 bg-nobunaga-red hover:bg-nobunaga-crimson text-white font-display text-sm tracking-wider uppercase rounded-2xl transition-all shadow-lg shadow-nobunaga-red/25 flex items-center justify-center gap-2 mt-2"
            >
              <span>Next Word (Enter / Space)</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
