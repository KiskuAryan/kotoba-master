import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';
import { Check, ArrowRight, BookOpen, Target, Sparkles, Smile } from 'lucide-react';

export default function OnboardingModal({ isOpen, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState('N5');
  const [dailyGoal, setDailyGoal] = useState(20);
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { updateSettings } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      api.getDecks(level).then((res) => {
        setDecks(res);
        if (res.length > 0) {
          setSelectedDeckId(res[0].id);
        }
      }).catch(console.error);
    }
  }, [isOpen, level]);

  if (!isOpen) return null;

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // 1. Update user settings
      await updateSettings({
        preferred_level: level,
        daily_goal: dailyGoal,
        onboarding_completed: true
      });

      // 2. Add initial deck to review queue
      if (selectedDeckId) {
        await api.addDeckToQueue(selectedDeckId);
      }

      showToast('Onboarding complete! Your personalized deck is ready.', 'success');
      onComplete?.();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-notebook-paper border-4 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl bg-notebook-grid text-slate-800">
        {/* Mascot & Sticker header */}
        <div className="flex items-center gap-4 mb-6 bg-white/90 p-4 rounded-2xl border-2 border-slate-800 shadow-sm">
          {/* Friendly Tanuki / Mascot Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-notebook-yellow border-2 border-slate-800 flex items-center justify-center text-3xl shadow-sm rotate-[-3deg]">
            🦊
          </div>
          <div className="flex-1">
            <div className="inline-block px-2.5 py-0.5 rounded-md bg-notebook-pink text-white text-[10px] font-black uppercase tracking-wider mb-1 rotate-1">
              Fumayo Guide
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 leading-snug">
              {step === 1 && "Konnichiwa! Let's set your starting point."}
              {step === 2 && "How many words would you like to master a day?"}
              {step === 3 && "Pick your first themed deck to begin."}
            </h3>
          </div>
        </div>

        {/* Step Progress Pill */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-2.5 rounded-full transition-all ${
                  step === s ? 'bg-nobunaga-red w-12' : step > s ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">Step {step} of 3</span>
        </div>

        {/* STEP 1: JLPT LEVEL */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 font-medium">
              Choose your current Japanese knowledge level. You can explore both levels anytime!
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setLevel('N5')}
                className={`p-5 rounded-2xl border-3 text-left transition-all ${
                  level === 'N5'
                    ? 'border-nobunaga-red bg-white shadow-md scale-[1.02]'
                    : 'border-slate-300 bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-display text-2xl font-black text-nobunaga-red">JLPT N5</span>
                  {level === 'N5' && <Check size={20} className="text-nobunaga-red" />}
                </div>
                <div className="text-xs font-bold text-slate-800">Complete Beginner</div>
                <div className="text-[11px] text-slate-500 mt-1">Greetings, daily food, basics, numbers & travel basics.</div>
              </button>

              <button
                type="button"
                onClick={() => setLevel('N4')}
                className={`p-5 rounded-2xl border-3 text-left transition-all ${
                  level === 'N4'
                    ? 'border-nobunaga-red bg-white shadow-md scale-[1.02]'
                    : 'border-slate-300 bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-display text-2xl font-black text-nobunaga-red">JLPT N4</span>
                  {level === 'N4' && <Check size={20} className="text-nobunaga-red" />}
                </div>
                <div className="text-xs font-bold text-slate-800">Elementary Learner</div>
                <div className="text-[11px] text-slate-500 mt-1">Workplace, society, emotions, compound verbs & expressions.</div>
              </button>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-slate-900 text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-nobunaga-red transition-all flex items-center gap-2"
              >
                <span>Next: Daily Goal</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DAILY GOAL */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 font-medium">
              Consistency is key in Japanese spaced repetition. What pace feels sustainable?
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { count: 10, label: 'Casual', desc: '5 min / day' },
                { count: 20, label: 'Recommended', desc: '10 min / day' },
                { count: 30, label: 'Intensive', desc: '15 min / day' }
              ].map((item) => (
                <button
                  key={item.count}
                  type="button"
                  onClick={() => setDailyGoal(item.count)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all ${
                    dailyGoal === item.count
                      ? 'border-nobunaga-red bg-white shadow-md scale-[1.03]'
                      : 'border-slate-300 bg-white/60 hover:bg-white'
                  }`}
                >
                  <div className="font-display text-3xl font-black text-slate-900 mb-1">{item.count}</div>
                  <div className="text-xs font-bold text-slate-800">{item.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-slate-900 text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-nobunaga-red transition-all flex items-center gap-2"
              >
                <span>Next: Choose First Deck</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PICK FIRST DECK */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 font-medium">
              Choose your first starter deck to immediately activate:
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => setSelectedDeckId(deck.id)}
                  className={`w-full p-3 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                    selectedDeckId === deck.id
                      ? 'border-nobunaga-red bg-white shadow-sm'
                      : 'border-slate-300 bg-white/60 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 bg-slate-100 rounded-xl">{deck.icon || '📖'}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{deck.title}</div>
                      <div className="text-[10px] text-slate-500">{deck.japanese_title} • {deck.word_count} words</div>
                    </div>
                  </div>
                  {selectedDeckId === deck.id && (
                    <div className="w-6 h-6 rounded-full bg-nobunaga-red text-white flex items-center justify-center">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleFinish}
                className="px-6 py-3 bg-nobunaga-red text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-nobunaga-crimson transition-all flex items-center gap-2 shadow-lg shadow-nobunaga-red/30"
              >
                <span>{isLoading ? 'Setting up...' : 'Start Learning!'}</span>
                <Sparkles size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
