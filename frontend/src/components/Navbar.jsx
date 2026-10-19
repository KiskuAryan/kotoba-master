import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, BookOpen, Layers, BarChart2, Settings, UserCheck, LogIn, Sparkles } from 'lucide-react';

export default function Navbar({ currentView, setCurrentView, dueCount = 0, openAuthModal, openOnboarding }) {
  const { user, isGuest, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'review', label: 'Review', icon: BookOpen, badge: dueCount > 0 ? dueCount : null },
    { id: 'decks', label: 'Decks', icon: Sparkles },
    { id: 'stats', label: 'Stats', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <button
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-nobunaga-red flex items-center justify-center font-display text-white text-lg font-bold shadow-md shadow-nobunaga-red/30 group-hover:scale-105 transition-transform border border-red-400/40">
            言
          </div>
          <div className="flex flex-col">
            <span className="font-display tracking-wider text-lg font-black text-slate-100 flex items-center gap-1.5">
              KOTOBA<span className="text-nobunaga-red">MASTER</span>
            </span>
            <span className="text-[10px] text-slate-400 font-sans tracking-widest uppercase">
              言葉マスター • JLPT N5/N4
            </span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all relative ${
                  isActive
                    ? 'bg-nobunaga-red text-white shadow-md shadow-nobunaga-red/25'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white text-nobunaga-red' : 'bg-nobunaga-red text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Streak indicator */}
          {user && (
            <div
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold"
              title="Daily Review Streak"
            >
              <Flame size={15} className="text-amber-500 fill-amber-500 animate-pulse" />
              <span>{user.streak_days || 0}d</span>
            </div>
          )}

          {/* User Status / Login Button */}
          {user ? (
            <div className="flex items-center gap-2">
              {isGuest ? (
                <button
                  onClick={() => openAuthModal('register')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-nobunaga-cream text-nobunaga-dark border border-amber-400/50 hover:bg-white transition-all shadow-sm"
                  title="Guest mode: your progress is stored locally in this session. Create account to sync."
                >
                  <UserCheck size={14} className="text-nobunaga-red" />
                  <span>Guest (Save Progress)</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-300 hidden sm:inline">
                    {user.username}
                  </span>
                  <button
                    onClick={logout}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-nobunaga-red hover:bg-nobunaga-crimson text-white transition-all shadow-md shadow-nobunaga-red/30"
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar for one-handed access */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 flex justify-around items-center py-2 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all relative ${
                isActive ? 'text-nobunaga-red' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon size={20} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-nobunaga-red text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
