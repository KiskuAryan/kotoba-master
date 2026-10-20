import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, Sparkles, BookOpen, Save, CheckCircle2, Bookmark } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { speakJapanese } from '../utils/audio';

export default function WordDetailModal({ wordId, isOpen, onClose, onWordUpdated }) {
  const [word, setWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [inReview, setInReview] = useState(false);

  const { showToast } = useToast();

  // Lock body scroll and handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && wordId) {
      setLoading(true);
      api.getWordDetail(wordId)
        .then((data) => {
          setWord(data);
          setNotes(data.user_notes || '');
          setInReview(data.is_in_review || false);
        })
        .catch((err) => showToast('Failed to load word: ' + err.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, wordId, showToast]);

  if (!isOpen) return null;

  const handleSaveNotes = async () => {
    if (!wordId) return;
    setSavingNotes(true);
    try {
      await api.updateWordNotes(wordId, notes);
      showToast('Notes saved successfully!', 'success');
      onWordUpdated?.();
    } catch (err) {
      showToast('Failed to save notes: ' + err.message, 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleReview = async () => {
    if (!wordId) return;
    try {
      const nextState = !inReview;
      await api.toggleWordReview(wordId, nextState);
      setInReview(nextState);
      showToast(nextState ? 'Added to review queue' : 'Removed from review queue', 'info');
      onWordUpdated?.();
    } catch (err) {
      showToast('Error updating queue status: ' + err.message, 'error');
    }
  };

  const handleGenerateAi = async () => {
    if (!word) return;
    setGeneratingAi(true);
    try {
      const res = await api.getAiExplanation(word.kanji, word.kana, word.meaning, word.level || 'N5');
      setWord((prev) => ({
        ...prev,
        example_sentence: res.example_sentence,
        example_translation: res.example_translation,
        mnemonic: res.mnemonic
      }));
      showToast('Generated fresh mnemonic & sentence via Gemini!', 'success');
      onWordUpdated?.();
    } catch (err) {
      showToast('AI generation notice: ' + err.message, 'warning');
    } finally {
      setGeneratingAi(false);
    }
  };

  const modalJSX = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors z-10"
        >
          <X size={20} />
        </button>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-nobunaga-red border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-400">Loading word details...</p>
          </div>
        ) : !word ? (
          <div className="py-16 text-center text-slate-400">Word not found.</div>
        ) : (
          <div className="space-y-6 overflow-y-auto pr-1">
            {/* Word Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 pr-8">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="font-kanji text-5xl font-bold text-white">{word.kanji}</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg text-amber-300 font-medium">{word.kana}</span>
                    <span className="text-xs text-slate-400 font-mono">[{word.romaji}]</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => speakJapanese(word.kana || word.kanji)}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors ml-2"
                  title="Pronounce"
                >
                  <Volume2 size={20} />
                </button>
              </div>

              <div className="text-right">
                <div className="text-amber-400 font-bold text-sm">
                  {'★'.repeat(word.stars ?? word.progress?.star_rating ?? 1)}
                  <span className="text-slate-600">{'★'.repeat(5 - (word.stars ?? word.progress?.star_rating ?? 1))}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Level: {word.level || word.jlpt_level || 'N5'}</div>
                <button
                  type="button"
                  onClick={handleToggleReview}
                  className={`mt-2 px-3 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all ${
                    inReview
                      ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <Bookmark size={12} />
                  <span>{inReview ? 'In Review Queue' : '+ Add to Queue'}</span>
                </button>
              </div>
            </div>

            {/* Meaning */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                English Meaning
              </div>
              <p className="text-xl font-bold text-slate-100">{word.meaning}</p>
            </div>

            {/* Example Sentence */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider">Example Sentence</span>
                {(word.example_sentence || word.example_ja) && (
                  <button
                    type="button"
                    onClick={() => speakJapanese(word.example_sentence || word.example_ja)}
                    className="text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Volume2 size={13} />
                    <span>Listen</span>
                  </button>
                )}
              </div>
              <p className="font-kanji text-base text-slate-200">
                {word.example_sentence || word.example_ja || 'No example sentence added yet.'}
              </p>
              <p className="text-xs text-slate-400 italic">
                {word.example_translation || word.example_en || ''}
              </p>
            </div>

            {/* Mnemonic */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase tracking-wider text-amber-400">
                  Memory Mnemonic
                </span>
                <button
                  type="button"
                  disabled={generatingAi}
                  onClick={handleGenerateAi}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                >
                  <Sparkles size={11} />
                  <span>{generatingAi ? 'Generating...' : 'Refresh AI Mnemonic'}</span>
                </button>
              </div>
              <p className="text-amber-200/90 leading-relaxed pt-1">
                {word.mnemonic || 'Click Refresh to generate an AI memory mnemonic.'}
              </p>
            </div>

            {/* Personal Notes Editor */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-400 uppercase tracking-wider">
                  Personal Study Notes
                </label>
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 border border-slate-700"
                >
                  <Save size={12} />
                  <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
                </button>
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write your personal reminders, associations, or grammar patterns here..."
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-nobunaga-red"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
}
