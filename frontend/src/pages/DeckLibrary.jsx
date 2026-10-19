import React, { useState, useEffect } from 'react';
import { Search, Sparkles, BookOpen, Layers, CheckCircle, Clock } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import DeckDetailModal from './DeckDetailModal';
import WordDetailModal from './WordDetailModal';

export default function DeckLibrary() {
  const [decks, setDecks] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [activeWordId, setActiveWordId] = useState(null);

  const { showToast } = useToast();

  const loadDecks = async () => {
    setLoading(true);
    try {
      const data = await api.getDecks(selectedLevel === 'ALL' ? undefined : selectedLevel);
      setDecks(data);
    } catch (err) {
      showToast('Failed to load decks: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecks();
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
    const q = searchQuery.toLowerCase();
    return (
      deck.title.toLowerCase().includes(q) ||
      deck.japanese_title.includes(q) ||
      deck.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in pb-24 md:pb-12 text-slate-100">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-nobunaga-red/20 border border-nobunaga-red/40 text-red-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={13} />
            <span>Themed Learning Modules</span>
          </div>
          <h1 className="font-display text-3xl font-black text-white">DECK LIBRARY</h1>
          <p className="text-xs text-slate-400">
            14 Hand-crafted decks covering JLPT N5 & N4 life vocabulary
          </p>
        </div>

        {/* Level Filters & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
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

          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search decks..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-nobunaga-red"
            />
          </div>
        </div>
      </div>

      {/* Grid of Opaque-Style Bordered Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-nobunaga-red border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading themed decks...</p>
        </div>
      ) : filteredDecks.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          No decks found matching your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDecks.map((deck, idx) => {
            const style = pastelStyles[idx % pastelStyles.length];
            const mastery = deck.mastery_percentage || 0;
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
                      {deck.icon || '📖'}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 border border-slate-700/80 text-slate-200">
                      {deck.level}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-white group-hover:text-nobunaga-red transition-colors">
                    {deck.title}
                  </h3>
                  <p className="text-xs font-kanji text-amber-300/80 mb-2">{deck.japanese_title}</p>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {deck.description}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-slate-800/80 space-y-3">
                  {/* Words & Due stats */}
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{deck.word_count} words</span>
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
      )}

      {/* Deck Detail Modal */}
      <DeckDetailModal
        deckId={activeDeckId}
        isOpen={!!activeDeckId}
        onClose={() => setActiveDeckId(null)}
        onWordClick={(wordId) => setActiveWordId(wordId)}
        onDeckQueued={() => {
          loadDecks();
        }}
      />

      {/* Word Detail Modal */}
      <WordDetailModal
        wordId={activeWordId}
        isOpen={!!activeWordId}
        onClose={() => setActiveWordId(null)}
        onWordUpdated={() => {
          loadDecks();
        }}
      />
    </div>
  );
}
