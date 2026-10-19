import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Volume2, BookOpen, Sparkles, Layers } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { speakJapanese } from '../utils/audio';

export default function DeckDetailModal({ deckId, isOpen, onClose, onWordClick, onDeckQueued }) {
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingQueue, setAddingQueue] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && deckId) {
      setLoading(true);
      api.getDeckDetail(deckId)
        .then((data) => setDeck(data))
        .catch((err) => showToast('Failed to load deck: ' + err.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, deckId, showToast]);

  if (!isOpen) return null;

  const handleAddToQueue = async () => {
    if (!deckId) return;
    setAddingQueue(true);
    try {
      const res = await api.addDeckToQueue(deckId);
      showToast(res.message || 'Deck added to review queue!', 'success');
      onDeckQueued?.();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddingQueue(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-nobunaga-red border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-400">Loading deck details...</p>
          </div>
        ) : !deck ? (
          <div className="py-12 text-center text-slate-400">Deck not found.</div>
        ) : (
          <>
            {/* Deck Header */}
            <div className="flex items-start gap-4 pb-4 border-b border-slate-800">
              <div className="text-4xl p-3 bg-slate-800 rounded-2xl border border-slate-700 shrink-0">
                {deck.icon || '🎌'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-nobunaga-red/20 border border-nobunaga-red/40 text-red-300 rounded text-[11px] font-bold">
                    {deck.level}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {deck.words?.length || 0} vocabulary items
                  </span>
                </div>
                <h2 className="font-display text-2xl font-black text-white">{deck.title}</h2>
                <p className="text-xs text-slate-400">{deck.japanese_title} • {deck.description}</p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Word List ({deck.words?.length || 0})
              </span>
              <button
                disabled={addingQueue}
                onClick={handleAddToQueue}
                className="px-4 py-2 bg-nobunaga-red hover:bg-nobunaga-crimson disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-nobunaga-red/20 flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>{addingQueue ? 'Adding...' : 'Add All to Review Queue'}</span>
              </button>
            </div>

            {/* Words Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
              {deck.words?.map((word) => (
                <div
                  key={word.id}
                  onClick={() => onWordClick?.(word.id)}
                  className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        speakJapanese(word.kanji || word.kana);
                      }}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 group-hover:text-amber-400 transition-colors"
                    >
                      <Volume2 size={16} />
                    </button>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-kanji text-lg font-bold text-white">{word.kanji}</span>
                        <span className="text-xs text-amber-300">{word.kana}</span>
                      </div>
                      <div className="text-xs text-slate-300">{word.meaning}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-400 font-mono font-bold">
                      {'★'.repeat(word.stars || 1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
