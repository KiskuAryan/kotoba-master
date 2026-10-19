import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  const loadUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await api.getMe();
      setUser(userData);
      try {
        const settingsData = await api.getSettings();
        setSettings(settingsData);
      } catch (e) {
        console.warn('Could not load user settings', e);
      }
    } catch (err) {
      console.warn('Failed to restore session:', err.message);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (usernameOrEmail, password) => {
    const res = await api.login(usernameOrEmail, password);
    setToken(res.access_token);
    setUser(res.user);
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch (e) {
      // ignore
    }
    return res.user;
  };

  const register = async (username, email, password) => {
    const res = await api.register(username, email, password);
    setToken(res.access_token);
    setUser(res.user);
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch (e) {
      // ignore
    }
    return res.user;
  };

  const loginGuest = async () => {
    const res = await api.loginGuest();
    setToken(res.access_token);
    setUser(res.user);
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch (e) {
      // ignore
    }
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setSettings(null);
  };

  const updateSettings = async (newSettings) => {
    const updated = await api.updateSettings(newSettings);
    setSettings(updated);
    return updated;
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        loading,
        isGuest: !!user?.is_guest,
        login,
        register,
        loginGuest,
        logout,
        updateSettings,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
