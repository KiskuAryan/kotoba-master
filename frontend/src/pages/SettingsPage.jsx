import React, { useState } from 'react';
import { Download, Upload, Save, Volume2, Target, Eye, Palette, Shield, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SettingsPage({ openAuthModal }) {
  const { user, isGuest, settings, updateSettings, logout } = useAuth();
  const { showToast } = useToast();

  const [dailyGoal, setDailyGoal] = useState(settings?.daily_goal || 20);
  const [preferredLevel, setPreferredLevel] = useState(settings?.preferred_level || 'N5');
  const [furiganaMode, setFuriganaMode] = useState(settings?.furigana_mode || 'always');
  const [audioAutoplay, setAudioAutoplay] = useState(settings?.audio_autoplay || false);
  const [theme, setTheme] = useState(settings?.theme || 'nobunaga');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await updateSettings({
        daily_goal: Number(dailyGoal),
        preferred_level: preferredLevel,
        furigana_mode: furiganaMode,
        audio_autoplay: audioAutoplay,
        theme: theme
      });
      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kotoba_master_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup downloaded successfully!', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        const res = await api.importData(payload);
        showToast(res.message || 'Backup imported successfully!', 'success');
      } catch (err) {
        showToast('Import error: ' + err.message, 'error');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in pb-24 md:pb-12 text-slate-100">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="font-display text-3xl font-black text-white">SETTINGS & CONFIGURATION</h1>
        <p className="text-xs text-slate-400">
          Personalize review goals, audio playback, and import/export study progress
        </p>
      </div>

      {/* Guest Mode Alert Banner */}
      {isGuest && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <div className="text-sm font-bold text-amber-300">You are browsing in Guest Mode</div>
              <p className="text-xs text-amber-200/80">
                Your progress is currently saved in this browser session. Create a permanent account to sync across devices.
              </p>
            </div>
          </div>
          <button
            onClick={() => openAuthModal('register')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs uppercase rounded-xl transition-all shadow-md shrink-0"
          >
            Create Permanent Account
          </button>
        </div>
      )}

      {/* Preferences Form */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
          <Target size={18} className="text-nobunaga-red" />
          <span>Study & Review Settings</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Daily Goal */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Daily Target Review Count ({dailyGoal} words)
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              className="w-full accent-nobunaga-red cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>5 Casual</span>
              <span>20 Standard</span>
              <span>50 Hardcore</span>
            </div>
          </div>

          {/* Preferred Level */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Default JLPT Level
            </label>
            <select
              value={preferredLevel}
              onChange={(e) => setPreferredLevel(e.target.value)}
              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-nobunaga-red"
            >
              <option value="N5">JLPT N5 (Beginner)</option>
              <option value="N4">JLPT N4 (Elementary)</option>
            </select>
          </div>

          {/* Furigana Display */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Furigana Reading Mode
            </label>
            <select
              value={furiganaMode}
              onChange={(e) => setFuriganaMode(e.target.value)}
              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-nobunaga-red"
            >
              <option value="always">Always Show Furigana</option>
              <option value="hover">Show on Hover / Tap Only</option>
              <option value="never">Hide Furigana (Kanji Only)</option>
            </select>
          </div>

          {/* Audio Autoplay */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Audio Autoplay
            </label>
            <label className="flex items-center gap-3 p-2.5 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={audioAutoplay}
                onChange={(e) => setAudioAutoplay(e.target.checked)}
                className="w-4 h-4 accent-nobunaga-red rounded cursor-pointer"
              />
              <span className="text-xs text-slate-300">
                Play Japanese pronunciation automatically when card flips
              </span>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            disabled={saving}
            onClick={handleSavePreferences}
            className="px-6 py-2.5 bg-nobunaga-red hover:bg-nobunaga-crimson disabled:opacity-50 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-all shadow-md shadow-nobunaga-red/30 flex items-center gap-2"
          >
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>

      {/* Data Backup & Portability Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div>
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Download size={18} className="text-amber-400" />
            <span>Export & Import Data</span>
          </h2>
          <p className="text-xs text-slate-400">
            Own your data. Export full JSON snapshots of your spaced-repetition schedules, notes, and deck history.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Export Button */}
          <button
            onClick={handleExportBackup}
            className="p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-2xl flex items-center justify-between transition-colors group"
          >
            <div className="text-left">
              <div className="text-xs font-bold text-white group-hover:text-amber-400">
                Export JSON Backup
              </div>
              <div className="text-[11px] text-slate-400">Download all review history & cards</div>
            </div>
            <Download size={18} className="text-slate-400 group-hover:text-amber-400" />
          </button>

          {/* Import Picker */}
          <label className="p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-colors group">
            <div className="text-left">
              <div className="text-xs font-bold text-white group-hover:text-emerald-400">
                {importing ? 'Importing...' : 'Import JSON Backup'}
              </div>
              <div className="text-[11px] text-slate-400">Restore or sync study database</div>
            </div>
            <Upload size={18} className="text-slate-400 group-hover:text-emerald-400" />
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Account Info & Logout */}
      {user && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400">Logged in as:</div>
            <div className="text-sm font-bold text-white">{user.username} ({user.email || 'Guest'})</div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-slate-800 hover:bg-red-950 border border-slate-700 hover:border-red-700 text-slate-300 hover:text-red-300 text-xs font-bold rounded-xl transition-all"
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
