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
  getDecks: async (level) => {
    const data = await request(level ? `/decks?level=${level}` : '/decks');
    if (!Array.isArray(data)) return [];
    return data.map((d) => ({
      ...d,
      title: d.title || d.name || 'Untitled Deck',
      name: d.name || d.title || 'Untitled Deck',
      japanese_title: d.japanese_title || d.name_ja || '',
      name_ja: d.name_ja || d.japanese_title || '',
      level: d.level || d.jlpt_level || 'N5',
      jlpt_level: d.jlpt_level || d.level || 'N5',
      word_count: d.word_count ?? d.total_words ?? 0,
      total_words: d.total_words ?? d.word_count ?? 0
    }));
  },
  getDeckDetail: async (deckId) => {
    const d = await request(`/decks/${deckId}`);
    if (!d) return null;
    const words = (d.words || []).map((w) => ({
      ...w,
      stars: w.stars ?? w.progress?.star_rating ?? 1,
      level: w.level ?? w.jlpt_level ?? 'N5',
      example_sentence: w.example_sentence ?? w.example_ja ?? '',
      example_translation: w.example_translation ?? w.example_en ?? '',
      is_in_review: w.is_in_review ?? w.progress?.is_in_review ?? false,
      user_notes: w.user_notes ?? w.progress?.user_notes ?? ''
    }));
    return {
      ...d,
      title: d.title || d.name || 'Untitled Deck',
      name: d.name || d.title || 'Untitled Deck',
      japanese_title: d.japanese_title || d.name_ja || '',
      name_ja: d.name_ja || d.japanese_title || '',
      level: d.level || d.jlpt_level || 'N5',
      jlpt_level: d.jlpt_level || d.level || 'N5',
      word_count: d.word_count ?? d.total_words ?? words.length,
      total_words: d.total_words ?? d.word_count ?? words.length,
      words
    };
  },
  addDeckToQueue: (deckId) =>
    request(`/decks/${deckId}/add-to-queue`, { method: 'POST' }),

  // Chapters & Minna no Nihongo Lessons
  getChapters: async () => {
    const res = await request('/chapters');
    return Array.isArray(res) ? res : [];
  },
  getChapterWords: async (lessonNumber) => {
    const res = await request(`/chapters/${lessonNumber}/words`);
    return Array.isArray(res) ? res : [];
  },
  addChapterToQueue: (lessonNumber) =>
    request(`/chapters/${lessonNumber}/add-all-to-review`, { method: 'POST' }),

  // Words
  getWords: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/words?${query}` : '/words');
  },
  getWordDetail: async (wordId) => {
    const data = await request(`/words/${wordId}`);
    if (!data) return null;
    return {
      ...data,
      stars: data.stars ?? data.progress?.star_rating ?? 1,
      level: data.level ?? data.jlpt_level ?? 'N5',
      example_sentence: data.example_sentence ?? data.example_ja ?? '',
      example_translation: data.example_translation ?? data.example_en ?? '',
      is_in_review: data.is_in_review ?? data.progress?.is_in_review ?? false,
      user_notes: data.user_notes ?? data.progress?.user_notes ?? ''
    };
  },
  updateWordNotes: (wordId, notes) =>
    request(`/words/${wordId}/notes`, { method: 'PUT', body: JSON.stringify({ notes }) }),
  toggleWordReview: (wordId, is_in_review) =>
    request(`/words/${wordId}/toggle-review`, { method: 'POST', body: JSON.stringify({ is_in_review }) }),

  // Reviews & SM-2
  getDueReviews: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const data = await request(query ? `/reviews/due?${query}` : '/reviews/due');
    const rawCards = Array.isArray(data) ? data : (data?.cards || []);
    const cards = rawCards.map((c) => ({
      ...c,
      id: c.id ?? c.word_id,
      word_id: c.word_id ?? c.id,
      romaji: c.romaji || '',
      options: c.options || [],
      stars: c.stars ?? c.star_rating ?? 1,
      star_rating: c.star_rating ?? c.stars ?? 1,
      level: c.level ?? c.jlpt_level ?? 'N5',
      example_sentence: c.example_sentence ?? c.example_ja ?? '',
      example_translation: c.example_translation ?? c.example_en ?? ''
    }));
    cards.due_count = data?.due_count ?? cards.length;
    cards.queue_size = data?.queue_size ?? cards.length;
    return cards;
  },
  submitReview: async (wordId, payloadOrRating, responseTimeMs = 0) => {
    let body = { word_id: wordId };
    if (typeof payloadOrRating === 'object') {
      body = { ...body, ...payloadOrRating };
    } else {
      body = { ...body, rating: payloadOrRating, response_time_ms: responseTimeMs };
    }
    const res = await request('/reviews/submit', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return {
      ...res,
      stars: res.stars ?? res.star_rating_after,
      newStars: res.newStars ?? res.star_rating_after
    };
  },

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
