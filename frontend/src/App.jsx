import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ReviewSession from './pages/ReviewSession';
import DeckLibrary from './pages/DeckLibrary';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import AuthModal from './pages/AuthModal';
import OnboardingModal from './pages/OnboardingModal';
import { api } from './api';

function AppContent() {
  const { user, loading, settings, loginGuest } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [dueCount, setDueCount] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('login');
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Poll / refresh due count
  const refreshDueCount = async () => {
    if (!user) {
      setDueCount(0);
      return;
    }
    try {
      const due = await api.getDueReviews({ limit: 100 });
      setDueCount(due.length);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    refreshDueCount();
  }, [user, currentView]);

  // Check if onboarding is needed
  useEffect(() => {
    if (user && settings && !settings.onboarding_completed) {
      setOnboardingOpen(true);
    }
  }, [user, settings]);

  const handleOpenAuth = (mode = 'login') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  };

  const handleStartGuest = async () => {
    try {
      await loginGuest();
      setCurrentView('dashboard');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-12 h-12 border-4 border-nobunaga-red border-t-transparent rounded-full animate-spin mb-4" />
        <span className="font-display tracking-widest text-lg font-bold text-white">
          KOTOBA MASTER
        </span>
      </div>
    );
  }

  // If not logged in, render the Nobunaga-style landing page
  if (!user) {
    return (
      <>
        <LandingPage
          onStartGuest={handleStartGuest}
          onOpenAuth={handleOpenAuth}
          onExploreDecks={() => handleOpenAuth('login')}
        />
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authInitialMode}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={() => {
            setCurrentView('dashboard');
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-nobunaga-red selection:text-white">
      {/* Global Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        dueCount={dueCount}
        openAuthModal={handleOpenAuth}
        openOnboarding={() => setOnboardingOpen(true)}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1">
        {currentView === 'dashboard' && (
          <Dashboard
            onStartReview={() => setCurrentView('review')}
            onBrowseDecks={() => setCurrentView('decks')}
            onViewStats={() => setCurrentView('stats')}
            openOnboarding={() => setOnboardingOpen(true)}
          />
        )}

        {currentView === 'review' && (
          <ReviewSession
            onBackToDashboard={() => {
              setCurrentView('dashboard');
              refreshDueCount();
            }}
            onBrowseDecks={() => setCurrentView('decks')}
          />
        )}

        {currentView === 'decks' && <DeckLibrary />}

        {currentView === 'stats' && <StatsPage />}

        {currentView === 'settings' && (
          <SettingsPage openAuthModal={handleOpenAuth} />
        )}
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={() => {
          refreshDueCount();
        }}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onComplete={() => {
          refreshDueCount();
          setCurrentView('dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
