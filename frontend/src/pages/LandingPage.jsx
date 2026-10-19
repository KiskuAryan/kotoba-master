import React, { useState } from 'react';
import { Volume2, Sparkles, Brain, Award, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { speakJapanese } from '../utils/audio';

export default function LandingPage({ onStartGuest, onOpenAuth, onExploreDecks }) {
  const [flipped, setFlipped] = useState(false);

  const sampleWord = {
    kanji: '武士',
    kana: 'ぶし',
    romaji: 'bushi',
    meaning: 'warrior, samurai',
    example: '武士は名誉を重んじる。',
    example_meaning: 'A warrior values honor.',
    mnemonic: 'A warrior (武) standing with dignified determination as an honorable gentleman (士).',
    stars: 3
  };

  return (
    <div className="min-h-screen bg-nobunaga-cream text-nobunaga-dark relative overflow-hidden flex flex-col selection:bg-nobunaga-red selection:text-white">
      {/* Background Japanese Watermark & Grids */}
      <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center font-display text-[25vw] font-black select-none text-nobunaga-red overflow-hidden">
        記憶
      </div>

      {/* Top Banner Bar */}
      <header className="border-b border-nobunaga-dark/15 px-6 py-4 flex items-center justify-between relative z-10 bg-nobunaga-cream/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-nobunaga-red text-white flex items-center justify-center font-display text-xl font-bold shadow-sm">
            言
          </div>
          <div>
            <h1 className="font-display tracking-widest text-xl font-black text-nobunaga-red">
              KOTOBA MASTER
            </h1>
            <p className="text-[10px] tracking-widest uppercase font-bold text-slate-600">
              織田信長 記憶体系 • JLPT N5 & N4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenAuth('login')}
            className="px-4 py-2 text-xs font-bold tracking-wider uppercase border border-nobunaga-dark/30 hover:border-nobunaga-red hover:text-nobunaga-red transition-all"
          >
            Sign In
          </button>
          <button
            onClick={onStartGuest}
            className="px-4 py-2 text-xs font-bold tracking-wider uppercase bg-nobunaga-red text-white hover:bg-nobunaga-crimson shadow-md transition-all flex items-center gap-1.5"
          >
            <Zap size={14} />
            <span>Instant Guest Play</span>
          </button>
        </div>
      </header>

      {/* Main Hero Section with Oda Nobunaga Aesthetics */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
        {/* Left Side Label (Japanese Vertical Callout) */}
        <div className="hidden xl:flex flex-col items-center justify-center border-r border-nobunaga-dark/20 pr-6 py-8">
          <div className="writing-vertical-rl text-xs font-bold tracking-[0.3em] uppercase text-nobunaga-red">
            絶対記憶 • 言葉の極意
          </div>
          <div className="w-px h-16 bg-nobunaga-red my-4"></div>
          <div className="text-[10px] text-slate-500 font-mono">1590</div>
        </div>

        {/* Hero Copy */}
        <div className="flex-1 max-w-2xl text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-nobunaga-red/30 bg-nobunaga-red/10 text-nobunaga-red text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Supercharged SM-2 Spaced Repetition</span>
          </div>

          <h2 className="font-display text-5xl sm:text-7xl font-black tracking-tight text-nobunaga-dark leading-[0.95]">
            CONQUER <br />
            <span className="text-nobunaga-red">JAPANESE</span> <br />
            VOCABULARY.
          </h2>

          <p className="text-slate-700 text-base sm:text-lg leading-relaxed max-w-xl font-medium">
            Master over 1,000 essential JLPT N5 and N4 words with ironclad retention. Built with 
            the SM-2 scheduling engine, intuitive 5-star mastery tiers, and context-rich AI mnemonics.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={onStartGuest}
              className="px-8 py-4 bg-nobunaga-red hover:bg-nobunaga-crimson text-white font-display text-lg tracking-wider uppercase shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 border-2 border-nobunaga-red"
            >
              <span>Start Reviewing Now (Free)</span>
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-6 py-4 bg-transparent border-2 border-nobunaga-dark text-nobunaga-dark hover:bg-nobunaga-dark hover:text-white font-display text-lg tracking-wider uppercase transition-all flex items-center justify-center gap-2"
            >
              <span>Create Account</span>
            </button>
          </div>

          <div className="flex items-center gap-6 pt-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-nobunaga-red" />
              <span>Zero-signup guest mode</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-nobunaga-red" />
              <span>Due-date SM-2 algorithm</span>
            </div>
            <div className="flex items-center gap-2">
              <Award size={16} className="text-nobunaga-red" />
              <span>14 Themed JLPT decks</span>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive 3D Sample Flip Card */}
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-2 px-2 text-xs font-bold text-slate-600 uppercase tracking-widest">
            <span>Live Interactive Preview</span>
            <span className="text-nobunaga-red animate-pulse">Click card to flip ↻</span>
          </div>

          <div
            onClick={() => setFlipped(!flipped)}
            className="w-full h-96 perspective-1000 cursor-pointer select-none group"
            title="Click or tap to flip card"
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d shadow-2xl rounded-2xl ${
                flipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* FRONT OF CARD */}
              <div className="absolute inset-0 backface-hidden bg-slate-900 text-white rounded-2xl p-8 border-2 border-nobunaga-red flex flex-col justify-between items-center shadow-xl">
                <div className="w-full flex justify-between items-center text-xs text-slate-400">
                  <span className="px-2 py-0.5 bg-nobunaga-red/30 border border-nobunaga-red/50 text-red-200 rounded font-mono">
                    JLPT N4 • Deck 01
                  </span>
                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                    {'★'.repeat(sampleWord.stars)}
                    <span className="text-slate-600">{'★'.repeat(5 - sampleWord.stars)}</span>
                  </div>
                </div>

                <div className="text-center my-auto flex flex-col items-center gap-3">
                  <div className="font-kanji text-7xl font-bold tracking-tight text-white group-hover:scale-105 transition-transform">
                    {sampleWord.kanji}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speakJapanese(sampleWord.kanji);
                    }}
                    className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-nobunaga-cream transition-colors border border-slate-700 shadow-sm"
                    title="Play Audio"
                  >
                    <Volume2 size={20} />
                  </button>
                </div>

                <div className="w-full text-center">
                  <div className="text-xs text-slate-400 bg-slate-800/80 py-2 rounded-lg border border-slate-700 font-medium">
                    Tap to reveal meaning & sentence
                  </div>
                </div>
              </div>

              {/* BACK OF CARD */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 text-white rounded-2xl p-6 border-2 border-amber-500/80 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
                    <span className="text-amber-400 font-bold text-xs">ANSWER REVEALED</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        speakJapanese(sampleWord.kana);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-kanji text-3xl font-bold text-white">{sampleWord.kanji}</span>
                    <span className="text-lg text-amber-300 font-medium">{sampleWord.kana}</span>
                    <span className="text-xs text-slate-400 font-mono">[{sampleWord.romaji}]</span>
                  </div>

                  <p className="text-lg font-bold text-slate-100 mb-3">{sampleWord.meaning}</p>

                  <div className="bg-slate-800/80 rounded-lg p-3 text-xs space-y-1 border border-slate-700/60 mb-2">
                    <p className="font-kanji text-slate-200">{sampleWord.example}</p>
                    <p className="text-slate-400 italic">{sampleWord.example_meaning}</p>
                  </div>

                  <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    <span className="font-bold">Mnemonic:</span> {sampleWord.mnemonic}
                  </div>
                </div>

                {/* Simulated SM-2 rating buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800">
                  <div className="py-1.5 text-center bg-red-950/70 border border-red-700 text-red-300 rounded text-[10px] font-bold">
                    Again (1d)
                  </div>
                  <div className="py-1.5 text-center bg-amber-950/70 border border-amber-700 text-amber-300 rounded text-[10px] font-bold">
                    Hard (3d)
                  </div>
                  <div className="py-1.5 text-center bg-blue-950/70 border border-blue-700 text-blue-300 rounded text-[10px] font-bold">
                    Good (7d)
                  </div>
                  <div className="py-1.5 text-center bg-emerald-950/70 border border-emerald-700 text-emerald-300 rounded text-[10px] font-bold">
                    Easy (14d)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Grids with thin framed panels */}
      <section className="border-t border-nobunaga-dark/15 bg-nobunaga-parchment/60 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-nobunaga-dark/30 p-6 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-nobunaga-red/10 border border-nobunaga-red/30 flex items-center justify-center text-nobunaga-red mb-4">
                <Brain size={22} />
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight mb-2">SM-2 Due Scheduling</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Replaced simple random quizzes with proven SuperMemo SM-2 spacing. Every review calculates the exact next repetition date based on recall performance.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-mono font-bold text-nobunaga-red">
              AGAIN • HARD • GOOD • EASY
            </div>
          </div>

          <div className="border border-nobunaga-dark/30 p-6 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-nobunaga-red/10 border border-nobunaga-red/30 flex items-center justify-center text-nobunaga-red mb-4">
                <Award size={22} />
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight mb-2">5-Star Retention Tiers</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Clear visual progression from 1★ (fresh card) up to 5★ (mastered 30+ day memory retention). Watch your star distribution shift as your proficiency solidifies.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-mono font-bold text-nobunaga-red">
              1★ → 2★ → 3★ → 4★ → 5★
            </div>
          </div>

          <div className="border border-nobunaga-dark/30 p-6 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-nobunaga-red/10 border border-nobunaga-red/30 flex items-center justify-center text-nobunaga-red mb-4">
                <Sparkles size={22} />
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight mb-2">14 Themed JLPT Decks</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Curated into thematic modules: Food & Dining, Daily Life, Travel, Office, Emotions, Nature, and more. Complete with AI sentence explanations and audio.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-mono font-bold text-nobunaga-red">
              JLPT N5 & N4 COMPLETE
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-nobunaga-dark/20 py-6 px-6 text-center text-xs font-medium text-slate-600 bg-nobunaga-cream">
        <p>© 2026 Kotoba Master. Engineered for Japanese Vocabulary Mastery.</p>
      </footer>
    </div>
  );
}
