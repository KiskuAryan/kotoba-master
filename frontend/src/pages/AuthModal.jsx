import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';
import { X, Mail, Lock, User, KeyRound, Sparkles, Inbox, ExternalLink, CheckCircle } from 'lucide-react';

export default function AuthModal({ initialMode = 'login', isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | 'reset' | 'dev_emails'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [devEmails, setDevEmails] = useState([]);

  const { login, register, loginGuest } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(username || email, password);
        showToast('Logged in successfully!', 'success');
        onAuthSuccess?.();
        onClose();
      } else if (mode === 'register') {
        const res = await register(username, email, password);
        showToast('Account created successfully! Check Dev Mailbox to verify.', 'success');
        onAuthSuccess?.();
        onClose();
      } else if (mode === 'forgot') {
        await api.forgotPassword(email);
        showToast('Password reset link sent to email! Check dev mailbox.', 'info');
        setMode('dev_emails');
      } else if (mode === 'reset') {
        await api.resetPassword(resetToken, newPassword);
        showToast('Password reset successfully! Please log in.', 'success');
        setMode('login');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setIsLoading(true);
    try {
      await loginGuest();
      showToast('Welcome! You are now in Guest Mode.', 'info');
      onAuthSuccess?.();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDevEmails = async () => {
    try {
      const data = await api.getDevEmails();
      setDevEmails(data);
    } catch (err) {
      console.warn('Failed to fetch dev emails:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto bg-nobunaga-red text-white flex items-center justify-center rounded-2xl font-display text-2xl font-black mb-3 shadow-md shadow-nobunaga-red/30">
            言
          </div>
          <h2 className="font-display tracking-wide text-2xl font-black text-white">
            {mode === 'login' && 'WELCOME BACK'}
            {mode === 'register' && 'JOIN KOTOBA MASTER'}
            {mode === 'forgot' && 'FORGOT PASSWORD'}
            {mode === 'reset' && 'SET NEW PASSWORD'}
            {mode === 'dev_emails' && 'DEV MAILBOX SIMULATOR'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login' && 'Sign in to sync your reviews, streak & stars'}
            {mode === 'register' && 'Create your personal Japanese learning journey'}
            {mode === 'forgot' && 'Enter your email to receive a password reset link'}
            {mode === 'reset' && 'Enter the reset token sent to your email'}
            {mode === 'dev_emails' && 'View locally generated verification & reset emails'}
          </p>
        </div>

        {/* Tab switcher for login / register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-slate-800 rounded-xl p-1 mb-6 border border-slate-700/60">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login' ? 'bg-nobunaga-red text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'register' ? 'bg-nobunaga-red text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* DEV MAILBOX VIEW */}
        {mode === 'dev_emails' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span>Captured Email Simulator ({devEmails.length})</span>
              <button
                onClick={fetchDevEmails}
                className="text-amber-400 hover:underline font-bold"
              >
                Refresh
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {devEmails.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-800/50 rounded-xl">
                  No simulated emails yet. Register or request password reset first.
                </div>
              ) : (
                devEmails.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>To: <strong className="text-slate-200">{item.to}</strong></span>
                      <span>{item.subject}</span>
                    </div>
                    {item.token && (
                      <div className="pt-1 flex items-center justify-between">
                        <span className="font-mono text-amber-300 text-[11px] truncate max-w-[200px]">
                          Token: {item.token}
                        </span>
                        <button
                          onClick={() => {
                            setResetToken(item.token);
                            setMode('reset');
                          }}
                          className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/40 font-bold text-[10px]"
                        >
                          Use Token
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setMode('login')}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. samurai99"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-nobunaga-red text-white"
                  />
                </div>
              </div>
            )}

            {(mode === 'register' || mode === 'forgot') && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-nobunaga-red text-white"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username or Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username or email"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-nobunaga-red text-white"
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-slate-300">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-slate-400 hover:text-nobunaga-red transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-nobunaga-red text-white"
                  />
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Reset Token</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste token here"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-nobunaga-red text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-nobunaga-red text-white"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-nobunaga-red hover:bg-nobunaga-crimson disabled:opacity-50 text-white font-display text-sm tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-nobunaga-red/30 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Loading...</span>
              ) : (
                <span>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'register' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                  {mode === 'reset' && 'Update Password'}
                </span>
              )}
            </button>
          </form>
        )}

        {/* Dev Mailbox Simulator Shortcut Button */}
        {mode !== 'dev_emails' && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <button
              onClick={() => {
                fetchDevEmails();
                setMode('dev_emails');
              }}
              className="hover:text-amber-400 flex items-center gap-1 text-[11px]"
            >
              <Inbox size={13} />
              <span>Dev Mailbox (Inspect Verification / Reset Links)</span>
            </button>
          </div>
        )}

        {/* Guest Mode option */}
        {(mode === 'login' || mode === 'register') && (
          <div className="mt-3">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-xs text-slate-500 uppercase font-mono">or</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>
            <button
              type="button"
              onClick={handleGuest}
              disabled={isLoading}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Instant Guest Mode (0-click trial)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
