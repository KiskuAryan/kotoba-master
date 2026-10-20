import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Sparkles, BookOpen, Layers, CheckCircle, Clock, GraduationCap, Check, Lock, ArrowRight, X } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import DeckDetailModal from './DeckDetailModal';
import WordDetailModal from './WordDetailModal';

// Locked Lesson Dialog rendered at root level via createPortal
function LockedLessonModal({ lesson, allLessons, isOpen, onClose, onStudyPrerequisite }) {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !lesson) return null;

  const prevLessonNum = lesson.lesson_number - 1;
  const prevLesson = allLessons?.find((c) => c.lesson_number === prevLessonNum);
  const prevMastery = lesson.prev_lesson_mastery ?? prevLesson?.mastery_percentage ?? 0;
  const reqMastery = lesson.required_mastery || 70;
  const progressRatio = Math.min(100, Math.round((prevMastery / reqMastery) * 100));

  const modalJSX = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 flex flex-col text-center my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mx-auto w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
          <Lock size={32} />
        </div>

        <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400 font-mono mb-1">
          PROGRESSION LOCKED
        </span>
        <h3 className="font-display text-2xl font-black text-white mb-2">
          Lesson {lesson.lesson_number} is Locked
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
          In the Minna no Nihongo curriculum, subsequent lessons require moderate-to-high mastery of earlier concepts before unlocking.
        </p>

        {/* Prerequisite Progress Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Prerequisite: Lesson {prevLessonNum}</span>
            </span>
            <span className="font-mono font-bold text-amber-400">
              {prevMastery}% / {reqMastery}%
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressRatio}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Current Mastery</span>
            <span>Needs {Math.max(0, Math.round(reqMastery - prevMastery))}% more to unlock</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {prevLesson && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStudyPrerequisite?.(prevLesson);
              }}
              className="flex-1 py-3 px-4 bg-nobunaga-red hover:bg-nobunaga-crimson text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-nobunaga-red/25 flex items-center justify-center gap-2"
            >
              <span>Study Lesson {prevLessonNum}</span>
              <ArrowRight size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
}

export default function DeckLibrary() {
  const [activeTab, setActiveTab] = useState('themed'); // 'themed' | 'minna'
  const [decks, setDecks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeWordId, setActiveWordId] = useState(null);
  const [lockedLessonTarget, setLockedLessonTarget] = useState(null);

  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [decksData, chaptersData] = await Promise.all([
        api.getDecks(selectedLevel === 'ALL' ? undefined : selectedLevel),
        api.getChapters()
      ]);
      setDecks(decksData || []);
      setChapters(chaptersData || []);
    } catch (err) {
      showToast('Failed to load decks: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLevel]);

  // Pastel accent palette for themed cards
  const pastelStyles = [
    { card: 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400', iconBg: 'bg-rose-500/10 text-rose-300' },
    { card: 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400', iconBg: 'bg-amber-500/10 text-amber-300' },
    { card: 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400', iconBg: 'bg-emerald-500/10 text-emerald-300' },
    { card: 'bg-sky-950/20 border-sky-500/40 hover:border-sky-400', iconBg: 'bg-sky-500/10 text-sky-300' },
    { card: 'bg-indigo-950/20 border-indigo-500/40 hover:border-indigo-400', iconBg: 'bg-indigo-500/10 text-indigo-300' },
    { card: 'bg-purple-950/20 border-purple-500/40 hover:border-purple-400', iconBg: 'bg-purple-500/10 text-purple-300' },
    { card: 'bg-teal-950/20 border-teal-500/40 hover:border-teal-400', iconBg: 'bg-teal-500/10 text-teal-300' }
  ];

  const filteredDecks = decks.filter((deck) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const title = (deck.title || deck.name || '').toLowerCase();
    const jaTitle = (deck.japanese_title || deck.name_ja || '').toLowerCase();
    const desc = (deck.description || '').toLowerCase();
    return title.includes(q) || jaTitle.includes(q) || desc.includes(q);
  });

  const filteredChapters = chapters.filter((chap) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const title = (chap.title || '').toLowerCase();
    const desc = (chap.description || '').toLowerCase();
    const num = String(chap.lesson_number);
    return title.includes(q) || desc.includes(q) || num === q;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in pb-24 md:pb-12 text-slate-100">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-nobunaga-red/20 border border-nobunaga-red/40 text-red-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={13} />
            <span>Spaced Repetition Deck Catalog</span>
          </div>
          <h1 className="font-display text-3xl font-black text-white">DECK LIBRARY</h1>
          <p className="text-xs text-slate-400">
            Study via thematic life topics or follow the classic Minna no Nihongo textbook syllabus.
          </p>
        </div>

        {/* Tab switch between Themed Decks and Minna no Nihongo Lessons */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('themed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'themed'
                ? 'bg-nobunaga-red text-white shadow-md shadow-nobunaga-red/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>Themed Decks ({decks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('minna')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'minna'
                ? 'bg-nobunaga-red text-white shadow-md shadow-nobunaga-red/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap size={14} />
            <span>Minna no Nihongo (25 Lessons)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        {activeTab === 'themed' ? (
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            {['ALL', 'N5', 'N4'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedLevel === lvl
                    ? 'bg-nobunaga-red text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl === 'ALL' ? 'All Levels' : `JLPT ${lvl}`}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-bold text-amber-400 flex items-center gap-2 px-2">
            <BookOpen size={15} />
            <span>みんなの日本語 初級 I • Progressive Syllabus (Lessons 1–25)</span>
          </div>
        )}

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'themed' ? "Search themes, kanji, meaning..." : "Search lesson, topic, words..."}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-nobunaga-red"
          />
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-nobunaga-red border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading catalog...</p>
        </div>
      ) : activeTab === 'themed' ? (
        // ==================== THEMED DECKS VIEW ====================
        filteredDecks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm bg-slate-900/30 rounded-3xl border border-slate-800">
            No themed decks found matching your filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDecks.map((deck, idx) => {
              const style = pastelStyles[idx % pastelStyles.length];
              const mastery = deck.mastery_percentage || 0;
              const title = deck.title || deck.name || 'Untitled Deck';
              const jaTitle = deck.japanese_title || deck.name_ja || '';
              const level = deck.level || deck.jlpt_level || 'N5';
              const wordsCount = deck.word_count ?? deck.total_words ?? 0;

              return (
                <div
                  key={deck.id}
                  onClick={() => setActiveDeckId(deck.id)}
                  className={`border-2 rounded-3xl p-6 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between group ${style.card}`}
                >
                  <div>
                    {/* Top Bar with Emoji & Level */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-white/10 ${style.iconBg}`}>
                        {deck.icon || '🌸'}
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 border border-slate-700/80 text-slate-200">
                        {level}
                      </span>
                    </div>

                    <h3 className="font-display text-xl font-bold text-white group-hover:text-nobunaga-red transition-colors">
                      {title}
                    </h3>
                    {jaTitle && <p className="text-xs font-kanji text-amber-300/90 mb-2">{jaTitle}</p>}
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {deck.description}
                    </p>
                  </div>

                  <div className="pt-6 mt-4 border-t border-slate-800/80 space-y-3">
                    {/* Words & Due stats */}
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>{wordsCount} words</span>
                      {deck.due_count > 0 ? (
                        <span className="text-nobunaga-red font-bold flex items-center gap-1">
                          <Clock size={12} />
                          {deck.due_count} due now
                        </span>
                      ) : (
                        <span className="text-slate-500">Ready to learn</span>
                      )}
                    </div>

                    {/* Mastery Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Retention Mastery</span>
                        <span className="font-bold text-slate-200">{mastery}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${mastery}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // ==================== MINNA NO NIHONGO LESSONS VIEW (AHA LAB PROGRESSION) ====================
        filteredChapters.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm bg-slate-900/30 rounded-3xl border border-slate-800">
            No Minna no Nihongo lessons found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredChapters.map((chap) => {
              const isUnlocked = chap.is_unlocked;
              const mastery = chap.mastery_percentage || 0;
              const isMastered = mastery >= 70;
              const prevMastery = chap.prev_lesson_mastery ?? 0;
              const reqMastery = chap.required_mastery || 70;

              return (
                <div
                  key={chap.lesson_number}
                  onClick={() => {
                    if (isUnlocked) {
                      setActiveLesson(chap);
                    } else {
                      setLockedLessonTarget(chap);
                    }
                  }}
                  className={`border-2 rounded-3xl p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                    isUnlocked
                      ? 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-nobunaga-red/60 hover:-translate-y-1 hover:shadow-xl'
                      : 'border-slate-800/80 bg-slate-950/60 hover:bg-slate-900/80 hover:border-amber-500/40 opacity-90'
                  }`}
                >
                  <div>
                    {/* Top Bar with Lesson Pill & Unlock Status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className={`px-3 py-1 rounded-xl font-display text-sm font-bold flex items-center gap-1.5 ${
                        isUnlocked
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          : 'bg-slate-800/80 border border-slate-700 text-slate-400'
                      }`}>
                        {!isUnlocked && <Lock size={12} className="text-amber-400" />}
                        <span>第{chap.lesson_number}課</span>
                      </div>

                      {isUnlocked ? (
                        isMastered ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 flex items-center gap-1">
                            <CheckCircle size={11} />
                            <span>Mastered</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                            Lesson {chap.lesson_number}
                          </span>
                        )
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                          <Lock size={10} />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>

                    <h3 className={`font-display text-lg font-bold transition-colors line-clamp-1 ${
                      isUnlocked ? 'text-white group-hover:text-nobunaga-red' : 'text-slate-300 group-hover:text-amber-300'
                    }`}>
                      {chap.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {chap.description}
                    </p>
                  </div>

                  {/* Locked vs Unlocked Footer */}
                  {isUnlocked ? (
                    <div className="pt-5 mt-4 border-t border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>{chap.total_words} vocabulary words</span>
                        <span className="text-emerald-400 font-medium">
                          {chap.words_in_review || 0} active
                        </span>
                      </div>

                      {/* Mastery Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>Lesson Mastery</span>
                          <span className="font-bold text-slate-200">{mastery}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isMastered ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${mastery}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-2">
                      <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-amber-400 font-medium flex items-center gap-1">
                            <Lock size={11} />
                            <span>Unlock Requirement</span>
                          </span>
                          <span className="font-mono text-slate-400">
                            {prevMastery}% / {reqMastery}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-400/80 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (prevMastery / reqMastery) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Reach {reqMastery}% mastery in Lesson {chap.lesson_number - 1} to unlock
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Locked Lesson Info Dialog */}
      <LockedLessonModal
        lesson={lockedLessonTarget}
        allLessons={chapters}
        isOpen={!!lockedLessonTarget}
        onClose={() => setLockedLessonTarget(null)}
        onStudyPrerequisite={(prereq) => {
          setActiveLesson(prereq);
        }}
      />

      {/* Deck Detail Modal (Supports both Themed Deck and Minna no Nihongo Lesson) */}
      <DeckDetailModal
        deckId={activeDeckId}
        lessonData={activeLesson}
        isOpen={!!activeDeckId || !!activeLesson}
        onClose={() => {
          setActiveDeckId(null);
          setActiveLesson(null);
        }}
        onWordClick={(wordId) => setActiveWordId(wordId)}
        onDeckQueued={() => {
          loadData();
        }}
      />

      {/* Word Detail Modal */}
      <WordDetailModal
        wordId={activeWordId}
        isOpen={!!activeWordId}
        onClose={() => setActiveWordId(null)}
        onWordUpdated={() => {
          loadData();
        }}
      />
    </div>
  );
}
