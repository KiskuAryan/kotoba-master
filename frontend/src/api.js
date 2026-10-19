// Kotoba Master API Client

const BASE_URL = '/api';

export function getToken() {
  return localStorage.getItem('kotoba_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('kotoba_token', token);
  } else {
    localStorage.removeItem('kotoba_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401 && token) {
    // If token expired, clear it
    setToken(null);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.detail || data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  register: (username, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (username_or_email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username_or_email, password }) }),
  loginGuest: () =>
    request('/auth/guest', { method: 'POST' }),
  getMe: () =>
    request('/auth/me'),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, new_password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),
  verifyEmail: (token) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  getDevEmails: () =>
    request('/auth/dev-emails'),

  // Decks
  getDecks: (level) =>
    request(level ? `/decks?level=${level}` : '/decks'),
  getDeckDetail: (deckId) =>
    request(`/decks/${deckId}`),
  addDeckToQueue: (deckId) =>
    request(`/decks/${deckId}/add-to-queue`, { method: 'POST' }),

  // Words
  getWords: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/words?${query}` : '/words');
  },
  getWordDetail: (wordId) =>
    request(`/words/${wordId}`),
  updateWordNotes: (wordId, notes) =>
    request(`/words/${wordId}/notes`, { method: 'PUT', body: JSON.stringify({ notes }) }),
  toggleWordReview: (wordId, is_in_review) =>
    request(`/words/${wordId}/toggle-review`, { method: 'POST', body: JSON.stringify({ is_in_review }) }),

  // Reviews & SM-2
  getDueReviews: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/reviews/due?${query}` : '/reviews/due');
  },
  submitReview: (wordId, rating, responseTimeMs = 0) =>
    request('/reviews/submit', {
      method: 'POST',
      body: JSON.stringify({ word_id: wordId, rating, response_time_ms: responseTimeMs })
    }),

  // Stats
  getStats: () =>
    request('/stats'),

  // Settings
  getSettings: () =>
    request('/settings'),
  updateSettings: (settingsData) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(settingsData) }),
  exportData: () =>
    request('/settings/export'),
  importData: (payload) =>
    request('/settings/import', { method: 'POST', body: JSON.stringify(payload) }),

  // AI Sentence & Mnemonic Generator
  getAiExplanation: (word, kana, meaning, level = 'N5') =>
    request('/ai/explain', {
      method: 'POST',
      body: JSON.stringify({ word, kana, meaning, level })
    })
};
