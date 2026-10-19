// KotobaMaster Application Logic (Minna no Nihongo & AHA Lab Learn/Review Architecture)

const state = {
  activeTab: "learn",
  selectedLesson: 1,
  chapters: [],
  chapterWords: [],
  currentCardIndex: 0,
  isCardFlipped: false,
  reviewQueueCount: 0,
  
  token: localStorage.getItem("kotoba_token") || null,
  user: null,
  
  // Quiz Session State
  session: {
    active: false,
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    currentStreak: 0,
    maxStreak: 0,
    size: 10,
    isEarlyPractice: false
  },
  isQuizSubmitting: false
};

// Authenticated fetch wrapper
async function apiFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }
  return fetch(url, { ...options, headers });
}

// --- DOM Cache ---
const els = {
  tabBtns: document.querySelectorAll(".tab-btn"),
  views: document.querySelectorAll(".view-section"),
  reviewBadgeCount: document.getElementById("review-badge-count"),

  // Learn Mode
  chapterSelect: document.getElementById("chapter-select"),
  learnMasteryFill: document.getElementById("learn-mastery-fill"),
  learnMasteryText: document.getElementById("learn-mastery-text"),
  addAllChapterBtn: document.getElementById("add-all-chapter-btn"),
  reviewThisChapterBtn: document.getElementById("review-this-chapter-btn"),
  
  flashcardStage: document.getElementById("flashcard-stage"),
  flashcardInner: document.getElementById("flashcard-inner"),
  fcLessonBadge: document.getElementById("fc-lesson-badge"),
  fcAudioBtn: document.getElementById("fc-audio-btn"),
  fcKanji: document.getElementById("fc-kanji"),
  fcKana: document.getElementById("fc-kana"),
  fcRomaji: document.getElementById("fc-romaji"),
  fcPosBadge: document.getElementById("fc-pos-badge"),
  fcMeaning: document.getElementById("fc-meaning"),
  fcExampleJa: document.getElementById("fc-example-ja"),
  fcExampleEn: document.getElementById("fc-example-en"),
  
  fcPrevBtn: document.getElementById("fc-prev-btn"),
  fcNextBtn: document.getElementById("fc-next-btn"),
  fcIndexIndicator: document.getElementById("fc-index-indicator"),
  fcReviewToggleBtn: document.getElementById("fc-review-toggle-btn"),
  fcReviewToggleIcon: document.getElementById("fc-review-toggle-icon"),
  fcReviewToggleText: document.getElementById("fc-review-toggle-text"),
  
  chapterListTitle: document.getElementById("chapter-list-title"),
  chapterListCount: document.getElementById("chapter-list-count"),
  chapterWordsGrid: document.getElementById("chapter-words-grid"),

  // Review Screens
  quizLobbyScreen: document.getElementById("quiz-lobby-screen"),
  quizActiveScreen: document.getElementById("quiz-active-screen"),
  quizCompletedScreen: document.getElementById("quiz-completed-screen"),

  // Review Lobby
  lobbyDueCount: document.getElementById("lobby-due-count"),
  lobbyQueueCount: document.getElementById("lobby-queue-count"),
  lobbyNextDue: document.getElementById("lobby-next-due"),
  reviewScopeSelect: document.getElementById("review-scope-select"),
  sessionSizeSelect: document.getElementById("session-size-select"),
  interleaveCheckbox: document.getElementById("interleave-checkbox"),
  startSessionBtn: document.getElementById("start-session-btn"),
  startPracticeBtn: document.getElementById("start-practice-btn"),

  // Active Quiz
  quizProgressIndicator: document.getElementById("quiz-progress-indicator"),
  quizSessionTypeBadge: document.getElementById("quiz-session-type-badge"),
  quizStreakDisplay: document.getElementById("quiz-streak-display"),
  quitSessionBtn: document.getElementById("quit-session-btn"),
  
  quizLessonBadge: document.getElementById("quiz-lesson-badge"),
  quizRetentionBadge: document.getElementById("quiz-retention-badge"),
  quizPosBadge: document.getElementById("quiz-pos-badge"),
  quizStarRating: document.getElementById("quiz-star-rating"),
  quizPromptKanji: document.getElementById("quiz-prompt-kanji"),
  quizPromptKana: document.getElementById("quiz-prompt-kana"),
  quizPromptRomaji: document.getElementById("quiz-prompt-romaji"),
  quizAudioBtn: document.getElementById("quiz-audio-btn"),
  quizOptionsGrid: document.getElementById("quiz-options-grid"),
  quizFeedbackCard: document.getElementById("quiz-feedback-card"),
  quizFeedbackStatus: document.getElementById("quiz-feedback-status"),
  quizFeedbackChange: document.getElementById("quiz-feedback-change"),
  quizExampleJa: document.getElementById("quiz-example-ja"),
  quizExampleEn: document.getElementById("quiz-example-en"),
  quizNextBtn: document.getElementById("quiz-next-btn"),

  // Completed Screen
  summaryScore: document.getElementById("summary-score"),
  summaryAccuracy: document.getElementById("summary-accuracy"),
  summaryStreak: document.getElementById("summary-streak"),
  summaryLobbyBtn: document.getElementById("summary-lobby-btn"),
  summaryLearnBtn: document.getElementById("summary-learn-btn"),

  // AI Breakdown
  aiBox: document.getElementById("ai-box"),
  aiExplainBtn: document.getElementById("ai-explain-btn"),
  aiSentence: document.getElementById("ai-sentence"),
  aiRomaji: document.getElementById("ai-romaji"),
  aiTranslation: document.getElementById("ai-translation"),
  aiGrammar: document.getElementById("ai-grammar"),
  aiMnemonic: document.getElementById("ai-mnemonic"),
  aiSourceBadge: document.getElementById("ai-source-badge"),

  // Roadmap & Analytics
  roadmapGrid: document.getElementById("roadmap-grid"),
  metricTotal: document.getElementById("metric-total"),
  metricInReview: document.getElementById("metric-in-review"),
  metricMastered: document.getElementById("metric-mastered"),
  metricAccuracy: document.getElementById("metric-accuracy"),
  starBarsContainer: document.getElementById("star-bars-container"),
  resetBtn: document.getElementById("reset-btn"),

  // Unlock Modal
  unlockModal: document.getElementById("unlock-modal"),
  unlockModalMessage: document.getElementById("unlock-modal-message"),
  unlockModalCloseBtn: document.getElementById("unlock-modal-close-btn"),

  // User Auth Controls
  authLoggedIn: document.getElementById("auth-logged-in"),
  authLoggedOut: document.getElementById("auth-logged-out"),
  currentUsername: document.getElementById("current-username"),
  openAuthBtn: document.getElementById("open-auth-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  authModal: document.getElementById("auth-modal"),
  authTabsRow: document.getElementById("auth-tabs-row"),
  authSubHeader: document.getElementById("auth-sub-header"),
  authSubTitle: document.getElementById("auth-sub-title"),
  authSubDesc: document.getElementById("auth-sub-desc"),
  tabAuthLogin: document.getElementById("tab-auth-login"),
  tabAuthRegister: document.getElementById("tab-auth-register"),
  authErrorMsg: document.getElementById("auth-error-msg"),
  authInfoMsg: document.getElementById("auth-info-msg"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  forgotForm: document.getElementById("forgot-form"),
  resetPasswordForm: document.getElementById("reset-password-form"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  linkToForgot: document.getElementById("link-to-forgot"),
  regUsername: document.getElementById("reg-username"),
  regEmail: document.getElementById("reg-email"),
  regPassword: document.getElementById("reg-password"),
  forgotEmail: document.getElementById("forgot-email"),
  linkForgotBackToLogin: document.getElementById("link-forgot-back-to-login"),
  resetTokenInput: document.getElementById("reset-token-input"),
  resetNewPassword: document.getElementById("reset-new-password"),
  linkResetBackToLogin: document.getElementById("link-reset-back-to-login"),
  authModalCloseBtn: document.getElementById("auth-modal-close-btn"),

  // Simulated Mailbox & Notifications
  openMailboxBtn: document.getElementById("open-mailbox-btn"),
  mailboxModal: document.getElementById("mailbox-modal"),
  closeMailboxBtn: document.getElementById("close-mailbox-btn"),
  refreshMailboxBtn: document.getElementById("refresh-mailbox-btn"),
  mailboxList: document.getElementById("mailbox-list"),
  mailboxUnreadCount: document.getElementById("mailbox-unread-count"),
  toastContainer: document.getElementById("toast-container")
};

// --- Japanese TTS ---
function playJapaneseAudio(text) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// --- Navigation ---
function initNavigation() {
  els.tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });
}

function switchTab(tabName) {
  els.tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  els.views.forEach(v => v.classList.toggle("active", v.id === `${tabName}-view`));
  state.activeTab = tabName;

  if (tabName === "learn") loadLesson(state.selectedLesson);
  if (tabName === "quiz") loadReviewLobby();
  if (tabName === "roadmap") loadRoadmap();
  if (tabName === "analytics") loadAnalytics();
}

function renderStarIcons(starCount) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += i <= starCount ? `<span class="star-filled">★</span>` : `<span class="star-empty">☆</span>`;
  }
  return html;
}

// ==================== 1. LEARN MODE (FLASHCARDS) ====================
async function loadChaptersList() {
  try {
    const res = await apiFetch("/api/chapters");
    state.chapters = await res.json();
    
    els.chapterSelect.innerHTML = "";
    if (els.reviewScopeSelect) {
      const currentScope = els.reviewScopeSelect.value || "all";
      els.reviewScopeSelect.innerHTML = `<option value="all">📚 All Unlocked Lessons</option>`;
      state.chapters.forEach(chap => {
        const opt = document.createElement("option");
        opt.value = chap.lesson_number;
        opt.textContent = `${chap.is_unlocked ? "🔓" : "🔒"} ${chap.title}`;
        if (!chap.is_unlocked) opt.disabled = true;
        els.chapterSelect.appendChild(opt);

        if (chap.is_unlocked && els.reviewScopeSelect) {
          const scopeOpt = document.createElement("option");
          scopeOpt.value = chap.lesson_number;
          scopeOpt.textContent = `Lesson ${chap.lesson_number}: ${chap.title}`;
          els.reviewScopeSelect.appendChild(scopeOpt);
        }
      });
      els.reviewScopeSelect.value = currentScope;
    } else {
      state.chapters.forEach(chap => {
        const opt = document.createElement("option");
        opt.value = chap.lesson_number;
        opt.textContent = `${chap.is_unlocked ? "🔓" : "🔒"} ${chap.title}`;
        if (!chap.is_unlocked) opt.disabled = true;
        els.chapterSelect.appendChild(opt);
      });
    }
    
    els.chapterSelect.value = state.selectedLesson;
  } catch (err) {
    console.error("Error loading chapters:", err);
  }
}

async function loadLesson(lessonNumber) {
  state.selectedLesson = lessonNumber;
  els.chapterSelect.value = lessonNumber;
  state.currentCardIndex = 0;
  state.isCardFlipped = false;
  els.flashcardInner.classList.remove("flipped");

  try {
    const res = await apiFetch(`/api/chapters/${lessonNumber}/words`);
    state.chapterWords = await res.json();
    
    const currentChap = state.chapters.find(c => c.lesson_number === lessonNumber);
    const masteryPct = currentChap ? currentChap.mastery_percentage : 0;
    els.learnMasteryFill.style.width = `${masteryPct}%`;
    els.learnMasteryText.textContent = `${masteryPct}%`;

    els.chapterListTitle.textContent = `Lesson ${lessonNumber} Vocabulary List`;
    els.chapterListCount.textContent = `${state.chapterWords.length} Words`;

    if (state.chapterWords.length > 0) {
      renderFlashcard(0);
      renderChapterWordsTable();
    } else {
      els.fcKanji.textContent = "—";
      els.fcKana.textContent = "No words in this lesson";
      els.fcRomaji.textContent = "";
      els.fcMeaning.textContent = "Coming soon";
      els.chapterWordsGrid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 1.5rem;">No vocabulary items yet for Lesson ${lessonNumber}.</div>`;
    }

    refreshReviewBadge();
  } catch (err) {
    console.error("Error loading lesson words:", err);
  }
}

function renderFlashcard(index) {
  if (!state.chapterWords || state.chapterWords.length === 0) return;
  const word = state.chapterWords[index];
  
  els.fcLessonBadge.textContent = `Lesson ${word.lesson_number}`;
  els.fcKanji.textContent = word.kanji || word.kana;
  els.fcKana.textContent = word.kanji ? word.kana : "";
  els.fcRomaji.textContent = word.romaji;
  
  els.fcPosBadge.textContent = word.part_of_speech;
  els.fcMeaning.textContent = word.meaning;
  els.fcExampleJa.textContent = word.example_ja || "—";
  els.fcExampleEn.textContent = word.example_en || "";

  els.fcIndexIndicator.textContent = `Word ${index + 1} of ${state.chapterWords.length}`;
  
  const inReview = word.progress && word.progress.is_in_review;
  updateReviewToggleBtnState(inReview);

  els.fcAudioBtn.onclick = (e) => {
    e.stopPropagation();
    playJapaneseAudio(word.kanji || word.kana);
  };
}

function updateReviewToggleBtnState(isInReview) {
  if (isInReview) {
    els.fcReviewToggleBtn.classList.add("active");
    els.fcReviewToggleIcon.textContent = "✓";
    els.fcReviewToggleText.textContent = "In Review Queue";
  } else {
    els.fcReviewToggleBtn.classList.remove("active");
    els.fcReviewToggleIcon.textContent = "📥";
    els.fcReviewToggleText.textContent = "Add to Review Queue";
  }
}

els.flashcardStage.addEventListener("click", () => {
  state.isCardFlipped = !state.isCardFlipped;
  els.flashcardInner.classList.toggle("flipped", state.isCardFlipped);
});

els.fcPrevBtn.addEventListener("click", () => {
  if (state.currentCardIndex > 0) {
    state.currentCardIndex--;
    state.isCardFlipped = false;
    els.flashcardInner.classList.remove("flipped");
    renderFlashcard(state.currentCardIndex);
  }
});

els.fcNextBtn.addEventListener("click", () => {
  if (state.currentCardIndex < state.chapterWords.length - 1) {
    state.currentCardIndex++;
    state.isCardFlipped = false;
    els.flashcardInner.classList.remove("flipped");
    renderFlashcard(state.currentCardIndex);
  }
});

els.fcReviewToggleBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  const word = state.chapterWords[state.currentCardIndex];
  if (!word) return;

  const currentStatus = word.progress && word.progress.is_in_review;
  const newStatus = !currentStatus;

  try {
    await apiFetch("/api/chapters/toggle-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word_id: word.id, is_in_review: newStatus })
    });
    
    if (word.progress) word.progress.is_in_review = newStatus;
    updateReviewToggleBtnState(newStatus);
    refreshReviewBadge();
    renderChapterWordsTable();
  } catch (err) {
    console.error("Error toggling review:", err);
  }
});

els.addAllChapterBtn.addEventListener("click", async () => {
  try {
    const res = await apiFetch(`/api/chapters/${state.selectedLesson}/add-all-to-review`, { method: "POST" });
    const data = await res.json();
    
    state.chapterWords.forEach(w => {
      if (w.progress) w.progress.is_in_review = true;
    });
    
    updateReviewToggleBtnState(true);
    refreshReviewBadge();
    renderChapterWordsTable();
    alert(`Added all ${data.added_count} words from Lesson ${state.selectedLesson} to your Review Queue!`);
  } catch (err) {
    console.error("Error adding all words to review:", err);
  }
});

els.chapterSelect.addEventListener("change", (e) => {
  loadLesson(parseInt(e.target.value));
});

function renderChapterWordsTable() {
  els.chapterWordsGrid.innerHTML = "";
  state.chapterWords.forEach((word, idx) => {
    const row = document.createElement("div");
    row.className = "word-row-item";
    const inReview = word.progress && word.progress.is_in_review;
    const stars = word.progress ? word.progress.star_rating : 1;

    row.innerHTML = `
      <div class="word-row-left">
        <button class="audio-btn" style="margin: 0; padding: 0.2rem 0.5rem;" onclick="event.stopPropagation(); playJapaneseAudio('${word.kanji || word.kana}')">🔊</button>
        <div class="word-row-text">
          <div class="jp">${word.kanji || word.kana} <span style="font-size: 0.8rem; font-weight: 400; color: #38bdf8;">(${word.kana})</span></div>
          <div class="en">${word.meaning}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 0.85rem;">${renderStarIcons(stars)}</span>
        <button class="pill-btn" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: ${inReview ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'}; color: ${inReview ? '#a7f3d0' : 'var(--text-muted)'}; border: 1px solid ${inReview ? 'var(--accent-green)' : 'var(--border-color)'};">
          ${inReview ? '✓ In Queue' : '+ Review'}
        </button>
      </div>
    `;

    row.addEventListener("click", () => {
      state.currentCardIndex = idx;
      state.isCardFlipped = false;
      els.flashcardInner.classList.remove("flipped");
      renderFlashcard(idx);
      window.scrollTo({ top: 120, behavior: "smooth" });
    });

    els.chapterWordsGrid.appendChild(row);
  });
}

// ==================== 2. REVIEW SESSION LOGIC (AHA LAB MODEL) ====================
async function loadReviewLobby() {
  // Show lobby screen, hide active and completed
  els.quizLobbyScreen.style.display = "block";
  els.quizActiveScreen.style.display = "none";
  els.quizCompletedScreen.style.display = "none";

  const scope = (els.reviewScopeSelect && els.reviewScopeSelect.value !== "all") ? parseInt(els.reviewScopeSelect.value) : null;
  const statusUrl = scope ? `/api/quiz/status?lesson=${scope}` : "/api/quiz/status";

  try {
    const res = await apiFetch(statusUrl);
    const status = await res.json();

    els.lobbyDueCount.textContent = status.due_count;
    els.lobbyQueueCount.textContent = status.total_in_review;
    
    if (status.total_in_review === 0) {
      els.lobbyNextDue.textContent = "—";
      els.startSessionBtn.disabled = false;
      els.startSessionBtn.style.background = "linear-gradient(135deg, #4f46e5, #0ea5e9)";
      els.startSessionBtn.textContent = `📖 Go to Learn & Add Words`;
      els.startSessionBtn.onclick = () => switchTab("learn");
      els.startPracticeBtn.style.display = "none";
    } else if (status.due_count > 0) {
      els.lobbyNextDue.textContent = "Ready!";
      els.lobbyNextDue.style.color = "var(--accent-green)";
      els.startSessionBtn.disabled = false;
      els.startSessionBtn.style.background = "linear-gradient(135deg, var(--accent-indigo), var(--accent-blue))";
      els.startSessionBtn.textContent = `🚀 Start Due Review (${status.due_count} Due)`;
      els.startSessionBtn.onclick = () => startReviewSession(false);
      els.startPracticeBtn.style.display = "block";
    } else if (status.next_due_in_minutes) {
      els.lobbyNextDue.textContent = `${status.next_due_in_minutes}m`;
      els.lobbyNextDue.style.color = "var(--accent-gold)";
      els.startSessionBtn.disabled = true;
      els.startSessionBtn.style.background = "rgba(255, 255, 255, 0.1)";
      els.startSessionBtn.textContent = `⏳ Next Review in ${status.next_due_in_minutes}m`;
      els.startPracticeBtn.style.display = "block";
    } else {
      els.lobbyNextDue.textContent = "Ready";
      els.startSessionBtn.disabled = false;
      els.startSessionBtn.textContent = `🚀 Start Review Session`;
      els.startSessionBtn.onclick = () => startReviewSession(false);
      els.startPracticeBtn.style.display = "block";
    }

    refreshReviewBadge();
  } catch (err) {
    console.error("Error loading review status:", err);
  }
}

// Start Session Handler
async function startReviewSession(isEarlyPractice = false) {
  const size = parseInt(els.sessionSizeSelect.value) || 10;
  const scope = (els.reviewScopeSelect && els.reviewScopeSelect.value !== "all") ? parseInt(els.reviewScopeSelect.value) : null;
  const interleave = els.interleaveCheckbox ? els.interleaveCheckbox.checked : true;
  
  let url = `/api/quiz/session?size=${size}&interleave=${interleave}`;
  if (scope) {
    url += `&lesson=${scope}`;
  }
  
  try {
    const res = await apiFetch(url);
    if (!res.ok) {
      alert("Please add vocabulary to your Review Queue in the Learn section first!");
      switchTab("learn");
      return;
    }

    const data = await res.json();
    if (!data.questions || data.questions.length === 0) {
      alert("No words available in review queue.");
      return;
    }

    // Initialize session state
    state.session = {
      active: true,
      questions: data.questions,
      currentIndex: 0,
      correctCount: 0,
      currentStreak: 0,
      maxStreak: 0,
      size: data.questions.length,
      isEarlyPractice: isEarlyPractice || data.is_early_practice
    };

    // Transition to Active Quiz Screen
    els.quizLobbyScreen.style.display = "none";
    els.quizCompletedScreen.style.display = "none";
    els.quizActiveScreen.style.display = "flex";

    els.quizSessionTypeBadge.textContent = state.session.isEarlyPractice ? "⚡ Early Practice (Weakest First)" : "⏱️ Due Review";
    els.quizSessionTypeBadge.style.background = state.session.isEarlyPractice ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)";
    els.quizSessionTypeBadge.style.color = state.session.isEarlyPractice ? "#fde047" : "#a7f3d0";

    renderCurrentSessionQuestion();
  } catch (err) {
    console.error("Error starting review session:", err);
  }
}

els.startSessionBtn.addEventListener("click", () => startReviewSession(false));
els.startPracticeBtn.addEventListener("click", () => startReviewSession(true));
els.quitSessionBtn.addEventListener("click", () => {
  if (confirm("Exit current review session?")) {
    loadReviewLobby();
  }
});

if (els.reviewScopeSelect) {
  els.reviewScopeSelect.addEventListener("change", () => {
    loadReviewLobby();
  });
}

if (els.reviewThisChapterBtn) {
  els.reviewThisChapterBtn.addEventListener("click", () => {
    const lesson = state.selectedLesson;
    switchTab("quiz");
    if (els.reviewScopeSelect) {
      els.reviewScopeSelect.value = lesson;
    }
    loadReviewLobby();
  });
}

function renderCurrentSessionQuestion() {
  state.isQuizSubmitting = false;
  els.quizFeedbackCard.style.display = "none";
  if (els.aiBox) els.aiBox.style.display = "none";
  if (els.aiExplainBtn) {
    els.aiExplainBtn.disabled = false;
    els.aiExplainBtn.textContent = "✨ AI Context & Mnemonic";
  }

  const q = state.session.questions[state.session.currentIndex];
  const idx = state.session.currentIndex;
  const total = state.session.questions.length;

  // Header & Indicators
  els.quizProgressIndicator.textContent = `Word ${idx + 1} of ${total}`;
  els.quizStreakDisplay.textContent = `🔥 ${state.session.currentStreak} Streak`;

  els.quizAudioBtn.style.display = "inline-flex";
  els.quizPromptKanji.textContent = q.prompt_kanji || q.prompt_kana;
  els.quizPromptKana.textContent = q.prompt_kanji ? q.prompt_kana : "";
  els.quizPromptRomaji.textContent = q.romaji;
  
  if (q.is_retention_check) {
    if (els.quizRetentionBadge) {
      els.quizRetentionBadge.style.display = "inline-flex";
      els.quizRetentionBadge.textContent = `🔄 Past Retention Check (Lesson ${q.lesson_number})`;
    }
    els.quizLessonBadge.textContent = `Lesson ${q.lesson_number}`;
    els.quizLessonBadge.style.background = "rgba(168, 85, 247, 0.25)";
    els.quizLessonBadge.style.color = "#e9d5ff";
    els.quizLessonBadge.style.borderColor = "rgba(168, 85, 247, 0.5)";
  } else {
    if (els.quizRetentionBadge) {
      els.quizRetentionBadge.style.display = "none";
    }
    els.quizLessonBadge.textContent = `Lesson ${q.lesson_number}`;
    els.quizLessonBadge.style.background = "rgba(14, 165, 233, 0.15)";
    els.quizLessonBadge.style.color = "#38bdf8";
    els.quizLessonBadge.style.borderColor = "rgba(56, 189, 248, 0.3)";
  }

  els.quizPosBadge.textContent = q.part_of_speech;
  els.quizStarRating.innerHTML = renderStarIcons(q.current_stars);

  // Render Choices
  els.quizOptionsGrid.innerHTML = "";
  q.options.forEach((opt, optIdx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span>${opt}</span><span class="option-key">${optIdx + 1}</span>`;
    btn.addEventListener("click", () => handleQuizSubmit(opt, btn));
    els.quizOptionsGrid.appendChild(btn);
  });

  els.quizAudioBtn.onclick = () => playJapaneseAudio(q.prompt_kanji || q.prompt_kana);
}

async function handleQuizSubmit(selectedOption, clickedBtn) {
  if (state.isQuizSubmitting || !state.session.active) return;
  state.isQuizSubmitting = true;

  const currentQ = state.session.questions[state.session.currentIndex];
  const buttons = els.quizOptionsGrid.querySelectorAll(".option-btn");
  buttons.forEach(b => b.disabled = true);

  try {
    const res = await apiFetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word_id: currentQ.word_id,
        selected_option: selectedOption
      })
    });

    const result = await res.json();
    
    // Update streak and scores
    if (result.is_correct) {
      state.session.correctCount++;
      state.session.currentStreak++;
      if (state.session.currentStreak > state.session.maxStreak) {
        state.session.maxStreak = state.session.currentStreak;
      }
      playJapaneseAudio(currentQ.prompt_kanji || currentQ.prompt_kana);
    } else {
      state.session.currentStreak = 0;
    }
    els.quizStreakDisplay.textContent = `🔥 ${state.session.currentStreak} Streak`;

    // Visual button states
    buttons.forEach(btn => {
      const text = btn.querySelector("span").textContent;
      if (text.toLowerCase() === result.correct_meaning.toLowerCase()) {
        btn.classList.add("correct");
      } else if (btn === clickedBtn && !result.is_correct) {
        btn.classList.add("incorrect");
      }
    });

    showQuizFeedback(result);

    // Chapter Unlock Check
    if (result.chapter_unlocked) {
      triggerUnlockCelebration(result.chapter_unlocked);
    }
  } catch (err) {
    console.error("Error submitting quiz answer:", err);
  }
}

function showQuizFeedback(result) {
  els.quizFeedbackCard.style.display = "block";
  
  if (result.is_correct) {
    els.quizFeedbackStatus.innerHTML = `<span style="color: var(--accent-green);">✓ Correct Recall!</span>`;
  } else {
    els.quizFeedbackStatus.innerHTML = `<span style="color: var(--accent-red);">✗ Incorrect (Correct: ${result.correct_meaning})</span>`;
  }

  let changeText = `⭐ ${result.star_rating_before} → ⭐ ${result.star_rating_after}`;
  let pillBg = "rgba(255, 255, 255, 0.1)";
  let pillColor = "var(--text-muted)";

  if (result.star_change > 0) {
    changeText += ` (+${result.star_change} Star)`;
    pillBg = "rgba(16, 185, 129, 0.2)";
    pillColor = "#6ee7b7";
  } else if (result.star_change < 0) {
    changeText += ` (${result.star_change} Stars)`;
    pillBg = "rgba(239, 68, 68, 0.2)";
    pillColor = "#fca5a5";
  }

  els.quizFeedbackChange.style.background = pillBg;
  els.quizFeedbackChange.style.color = pillColor;
  els.quizFeedbackChange.textContent = changeText;

  els.quizExampleJa.textContent = result.example_ja || "—";
  els.quizExampleEn.textContent = result.example_en || "";

  // Check if this was the last question in the session
  const isLastQuestion = (state.session.currentIndex >= state.session.questions.length - 1);
  if (isLastQuestion) {
    els.quizNextBtn.innerHTML = `<span>Complete Session 🏁</span>`;
    els.quizNextBtn.onclick = () => showSessionCompleted();
  } else {
    els.quizNextBtn.innerHTML = `<span>Next Word</span> <span style="font-size: 0.8rem; opacity: 0.75;">[Enter ↵]</span>`;
    els.quizNextBtn.onclick = () => advanceSession();
  }
  els.quizNextBtn.focus();

  // AI Context
  if (els.aiExplainBtn) {
    els.aiExplainBtn.onclick = async () => {
      els.aiExplainBtn.disabled = true;
      els.aiExplainBtn.textContent = "⏳ Generating AI Context...";
      const currentQ = state.session.questions[state.session.currentIndex];
      try {
        const res = await fetch("/api/ai/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: currentQ.prompt_kanji || currentQ.prompt_kana,
            kana: currentQ.prompt_kana,
            meaning: result.correct_meaning,
            level: currentQ.jlpt_level
          })
        });
        const aiData = await res.json();
        els.aiSentence.textContent = aiData.japanese_sentence;
        els.aiRomaji.textContent = aiData.romaji;
        els.aiTranslation.textContent = aiData.english_translation;
        els.aiGrammar.innerHTML = `<strong>Grammar:</strong> ${aiData.grammar_breakdown}`;
        els.aiMnemonic.innerHTML = `💡 <strong>Mnemonic:</strong> ${aiData.mnemonic}`;
        els.aiSourceBadge.textContent = aiData.source === "gemini-api" ? "Powered by Gemini" : "Curated AI Engine";
        els.aiBox.style.display = "block";
        els.aiExplainBtn.textContent = "✓ Context Loaded";
      } catch (err) {
        els.aiExplainBtn.textContent = "⚠️ Failed to load AI context";
      }
    };
  }
}

function advanceSession() {
  state.session.currentIndex++;
  renderCurrentSessionQuestion();
}

function showSessionCompleted() {
  state.session.active = false;
  els.quizActiveScreen.style.display = "none";
  els.quizCompletedScreen.style.display = "block";

  const total = state.session.questions.length;
  const correct = state.session.correctCount;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  els.summaryScore.textContent = `${correct} / ${total}`;
  els.summaryAccuracy.textContent = `${pct}%`;
  els.summaryStreak.textContent = `🔥 ${state.session.maxStreak}`;

  refreshReviewBadge();
  loadChaptersList();
}

els.summaryLobbyBtn.addEventListener("click", () => loadReviewLobby());
els.summaryLearnBtn.addEventListener("click", () => switchTab("learn"));

function triggerUnlockCelebration(unlockedLessonNumber) {
  els.unlockModalMessage.innerHTML = `
    Congratulations! You reached <strong>75%+ Mastery</strong> on the previous lesson.<br><br>
    <strong>Minna no Nihongo Lesson ${unlockedLessonNumber}</strong> is now unlocked and ready to study!
  `;
  els.unlockModal.classList.add("active");
  els.unlockModalCloseBtn.onclick = () => {
    els.unlockModal.classList.remove("active");
    loadChaptersList().then(() => {
      loadLesson(unlockedLessonNumber);
      switchTab("learn");
    });
  };
}

// ==================== 3. ROADMAP VIEW ====================
async function loadRoadmap() {
  els.roadmapGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">Loading curriculum map...</div>`;
  try {
    const res = await apiFetch("/api/chapters");
    state.chapters = await res.json();
    els.roadmapGrid.innerHTML = "";

    state.chapters.forEach(chap => {
      const card = document.createElement("div");
      card.className = `roadmap-card ${chap.is_unlocked ? 'unlocked' : 'locked'}`;

      card.innerHTML = `
        <div>
          <div class="roadmap-card-header">
            <span class="badge" style="background: ${chap.is_unlocked ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)'}; color: ${chap.is_unlocked ? '#60a5fa' : '#94a3b8'};">
              ${chap.is_unlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
            </span>
            <span style="font-size: 0.8rem; font-weight: 700; color: ${chap.mastery_percentage >= 75 ? 'var(--accent-green)' : '#38bdf8'};">
              ${chap.mastery_percentage}% Mastery
            </span>
          </div>
          <div class="roadmap-card-title">${chap.title}</div>
          <div class="roadmap-card-desc">${chap.description || ''}</div>
        </div>

        <div style="margin-top: 1rem;">
          <div class="mastery-progress-track" style="width: 100%; margin-bottom: 0.5rem;">
            <div class="mastery-progress-fill" style="width: ${chap.mastery_percentage}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
            <span>${chap.total_words} Words (${chap.words_in_review} in review)</span>
            <span>${chap.is_unlocked ? 'Study →' : 'Requires 75%'}</span>
          </div>
        </div>
      `;

      if (chap.is_unlocked) {
        card.addEventListener("click", () => {
          loadLesson(chap.lesson_number);
          switchTab("learn");
        });
      }

      els.roadmapGrid.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading roadmap:", err);
  }
}

// ==================== 4. ANALYTICS & PROGRESS ====================
async function loadAnalytics() {
  try {
    const res = await apiFetch("/api/decks/summary");
    const data = await res.json();

    els.metricTotal.textContent = data.total_words;
    els.metricInReview.textContent = data.words_in_review;
    els.metricMastered.textContent = data.mastered_count;
    els.metricAccuracy.textContent = `${data.overall_accuracy}%`;

    els.starBarsContainer.innerHTML = "";
    const total = data.total_words || 1;
    for (let s = 5; s >= 1; s--) {
      const count = data.star_distribution[s] || 0;
      const pct = Math.round((count / total) * 100);

      const row = document.createElement("div");
      row.className = "star-bar-row";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "1rem";
      row.style.marginBottom = "0.75rem";
      row.style.fontSize = "0.85rem";

      row.innerHTML = `
        <div style="width: 90px; color: var(--accent-gold); font-weight: 600;">${renderStarIcons(s)}</div>
        <div class="mastery-progress-track" style="flex: 1; height: 12px;">
          <div class="mastery-progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, var(--accent-gold), #fbbf24);"></div>
        </div>
        <div style="width: 45px; text-align: right; color: var(--text-muted);">${count} (${pct}%)</div>
      `;
      els.starBarsContainer.appendChild(row);
    }
  } catch (err) {
    console.error("Error loading analytics:", err);
  }
}

async function refreshReviewBadge() {
  try {
    const res = await apiFetch("/api/quiz/status");
    const data = await res.json();
    els.reviewBadgeCount.textContent = data.due_count || 0;
  } catch (err) {}
}

if (els.resetBtn) {
  els.resetBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset all progress, star ratings, and review queues?")) return;
    await apiFetch("/api/decks/reset", { method: "POST" });
    loadAnalytics();
    refreshReviewBadge();
    loadLesson(state.selectedLesson);
    alert("Progress successfully reset!");
  });
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = "info", duration = 4000) {
  if (!els.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" ? "✅" : (type === "warning" ? "⚠️" : (type === "error" ? "❌" : "ℹ️"));
  toast.innerHTML = `<span style="font-size: 1.1rem;">${icon}</span><div style="flex: 1;">${message}</div>`;
  
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==================== 5. USER AUTHENTICATION & MULTI-USER SYNC ====================
function initAuth() {
  if (els.openAuthBtn) {
    els.openAuthBtn.addEventListener("click", () => showAuthModal("login"));
  }

  if (els.authModalCloseBtn) {
    els.authModalCloseBtn.addEventListener("click", () => {
      els.authModal.style.display = "none";
    });
  }

  if (els.tabAuthLogin) {
    els.tabAuthLogin.addEventListener("click", () => showAuthModal("login"));
  }

  if (els.tabAuthRegister) {
    els.tabAuthRegister.addEventListener("click", () => showAuthModal("register"));
  }

  if (els.linkToForgot) {
    els.linkToForgot.addEventListener("click", (e) => {
      e.preventDefault();
      showAuthModal("forgot");
    });
  }

  if (els.linkForgotBackToLogin) {
    els.linkForgotBackToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      showAuthModal("login");
    });
  }

  if (els.linkResetBackToLogin) {
    els.linkResetBackToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      showAuthModal("login");
    });
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener("click", () => logoutUser());
  }

  if (els.loginForm) {
    els.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleLogin();
    });
  }

  if (els.registerForm) {
    els.registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleRegister();
    });
  }

  if (els.forgotForm) {
    els.forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleForgotPassword();
    });
  }

  if (els.resetPasswordForm) {
    els.resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleResetPassword();
    });
  }

  // Simulated Mailbox controls
  if (els.openMailboxBtn) {
    els.openMailboxBtn.addEventListener("click", () => openMailbox());
  }
  if (els.closeMailboxBtn) {
    els.closeMailboxBtn.addEventListener("click", () => {
      els.mailboxModal.style.display = "none";
    });
  }
  if (els.refreshMailboxBtn) {
    els.refreshMailboxBtn.addEventListener("click", () => renderMailboxList());
  }
}

function showAuthModal(mode = "login", prefillToken = "") {
  els.authModal.style.display = "flex";
  els.authErrorMsg.style.display = "none";
  els.authInfoMsg.style.display = "none";

  // Reset forms visibility
  els.loginForm.style.display = "none";
  els.registerForm.style.display = "none";
  els.forgotForm.style.display = "none";
  els.resetPasswordForm.style.display = "none";

  if (mode === "login") {
    els.authTabsRow.style.display = "flex";
    els.authSubHeader.style.display = "none";
    els.loginForm.style.display = "block";
    
    els.tabAuthLogin.style.background = "rgba(99, 102, 241, 0.25)";
    els.tabAuthLogin.style.color = "#c7d2fe";
    els.tabAuthLogin.style.borderColor = "var(--accent-indigo)";
    els.tabAuthRegister.style.background = "transparent";
    els.tabAuthRegister.style.color = "var(--text-muted)";
    els.tabAuthRegister.style.borderColor = "transparent";
  } else if (mode === "register") {
    els.authTabsRow.style.display = "flex";
    els.authSubHeader.style.display = "none";
    els.registerForm.style.display = "block";

    els.tabAuthRegister.style.background = "rgba(16, 185, 129, 0.25)";
    els.tabAuthRegister.style.color = "#a7f3d0";
    els.tabAuthRegister.style.borderColor = "var(--accent-green)";
    els.tabAuthLogin.style.background = "transparent";
    els.tabAuthLogin.style.color = "var(--text-muted)";
    els.tabAuthLogin.style.borderColor = "transparent";
  } else if (mode === "forgot") {
    els.authTabsRow.style.display = "none";
    els.authSubHeader.style.display = "block";
    els.authSubTitle.textContent = "🔑 Forgot Password";
    els.authSubDesc.textContent = "Enter your registered email to receive password reset instructions.";
    els.forgotForm.style.display = "block";
  } else if (mode === "reset") {
    els.authTabsRow.style.display = "none";
    els.authSubHeader.style.display = "block";
    els.authSubTitle.textContent = "🔐 Choose New Password";
    els.authSubDesc.textContent = "Enter your reset token and choose a new password.";
    els.resetPasswordForm.style.display = "block";
    if (prefillToken) {
      els.resetTokenInput.value = prefillToken;
    }
  }
}

async function checkAuthStatus() {
  if (!state.token) {
    renderAuthUI(null);
    return;
  }

  try {
    const res = await apiFetch("/api/auth/me");
    if (res.ok) {
      const user = await res.json();
      state.user = user;
      renderAuthUI(user);
    } else {
      localStorage.removeItem("kotoba_token");
      state.token = null;
      state.user = null;
      renderAuthUI(null);
    }
  } catch (err) {
    console.error("Auth check error:", err);
  }
}

function renderAuthUI(user) {
  if (user) {
    els.authLoggedIn.style.display = "flex";
    els.authLoggedOut.style.display = "none";
    els.currentUsername.textContent = user.username + (user.is_verified ? " ✓" : "");
    if (user.is_verified) {
      els.currentUsername.title = "Verified Account";
    }
  } else {
    els.authLoggedIn.style.display = "none";
    els.authLoggedOut.style.display = "flex";
  }
}

async function handleLogin() {
  const usernameOrEmail = els.loginUsername.value.trim();
  const password = els.loginPassword.value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: usernameOrEmail,
        password: password
      })
    });

    const data = await res.json();
    if (!res.ok) {
      els.authErrorMsg.textContent = data.detail || "Login failed.";
      els.authErrorMsg.style.display = "block";
      return;
    }

    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem("kotoba_token", data.access_token);
    renderAuthUI(data.user);
    els.authModal.style.display = "none";
    els.loginPassword.value = "";

    showToast(`🔐 Welcome back, ${data.user.username}! Login confirmation sent to ${data.user.email}.`, "success");
    updateMailboxCount();

    await loadChaptersList();
    await loadLesson(state.selectedLesson);
    refreshReviewBadge();
  } catch (err) {
    els.authErrorMsg.textContent = "Network error. Please try again.";
    els.authErrorMsg.style.display = "block";
  }
}

async function handleRegister() {
  const username = els.regUsername.value.trim();
  const email = els.regEmail.value.trim();
  const password = els.regPassword.value;

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      els.authErrorMsg.textContent = data.detail || "Registration failed.";
      els.authErrorMsg.style.display = "block";
      return;
    }

    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem("kotoba_token", data.access_token);
    renderAuthUI(data.user);
    els.authModal.style.display = "none";
    els.regPassword.value = "";

    showToast(`🌸 Welcome to KotobaMaster, ${data.user.username}! Confirmation email sent to ${data.user.email}.`, "success");
    updateMailboxCount();

    await loadChaptersList();
    await loadLesson(1);
    refreshReviewBadge();
  } catch (err) {
    els.authErrorMsg.textContent = "Network error. Please try again.";
    els.authErrorMsg.style.display = "block";
  }
}

async function handleForgotPassword() {
  const email = els.forgotEmail.value.trim();
  if (!email) return;

  try {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    els.authErrorMsg.style.display = "none";
    
    if (data.dev_token) {
      els.authInfoMsg.innerHTML = `
        <div>${data.message}</div>
        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(16, 185, 129, 0.4);">
          <strong style="color: #6ee7b7;">⚡ Dev Token:</strong> <code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">${data.dev_token}</code><br>
          <button id="btn-use-dev-token" type="button" class="pill-btn" style="margin-top: 0.5rem; background: #6366f1; color: white; padding: 0.3rem 0.7rem; font-size: 0.75rem;">Continue with this Token →</button>
        </div>
      `;
      els.authInfoMsg.style.display = "block";
      document.getElementById("btn-use-dev-token")?.addEventListener("click", () => {
        showAuthModal("reset", data.dev_token);
      });
    } else {
      els.authInfoMsg.textContent = data.message;
      els.authInfoMsg.style.display = "block";
    }

    showToast("📨 Password reset instructions sent!", "info");
    updateMailboxCount();
  } catch (err) {
    els.authErrorMsg.textContent = "Unable to process request. Please try again.";
    els.authErrorMsg.style.display = "block";
  }
}

async function handleResetPassword() {
  const token = els.resetTokenInput.value.trim();
  const newPassword = els.resetNewPassword.value;

  if (!token || !newPassword) return;

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token,
        new_password: newPassword
      })
    });

    const data = await res.json();
    if (!res.ok) {
      els.authErrorMsg.textContent = data.detail || "Password reset failed.";
      els.authErrorMsg.style.display = "block";
      return;
    }

    showAuthModal("login");
    els.authInfoMsg.textContent = "Your password has been successfully reset! You can now sign in.";
    els.authInfoMsg.style.display = "block";
    els.resetNewPassword.value = "";
    els.resetTokenInput.value = "";
    showToast("🔐 Password reset complete! Please sign in.", "success");
  } catch (err) {
    els.authErrorMsg.textContent = "Failed to reset password. Please try again.";
    els.authErrorMsg.style.display = "block";
  }
}

async function logoutUser() {
  localStorage.removeItem("kotoba_token");
  state.token = null;
  state.user = null;
  renderAuthUI(null);
  showToast("Logged out successfully.", "info");
  await loadChaptersList();
  await loadLesson(1);
  refreshReviewBadge();
}

// ==================== SIMULATED MAILBOX ====================
async function openMailbox() {
  els.mailboxModal.style.display = "flex";
  await renderMailboxList();
}

async function renderMailboxList() {
  try {
    const res = await fetch("/api/auth/dev-emails");
    const emails = await res.json();
    
    if (!emails || emails.length === 0) {
      els.mailboxList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
          <p>No emails logged yet.</p>
          <p style="font-size: 0.75rem; margin-top: 0.25rem;">Sign in, register, or request a password reset to see outgoing emails appear here.</p>
        </div>
      `;
      return;
    }

    els.mailboxList.innerHTML = emails.map((mail, idx) => {
      const typeBadge = mail.type === "login_alert" 
        ? `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem;">🔐 Login Alert</span>`
        : (mail.type === "welcome"
          ? `<span style="background: rgba(99, 102, 241, 0.2); color: #818cf8; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem;">🌸 Welcome</span>`
          : `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem;">🔑 Password Reset</span>`);

      const tokenAction = mail.token ? `
        <button class="pill-btn btn-use-mail-token" data-token="${mail.token}" data-type="${mail.type}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: #6366f1; color: white;">
          ${mail.type === 'welcome' ? '✓ Verify Email' : '🔑 Use Reset Token'}
        </button>
      ` : '';

      return `
        <div class="email-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <div>${typeBadge}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(mail.timestamp).toLocaleTimeString()}</div>
          </div>
          <div style="font-weight: 600; font-size: 0.9rem; color: #f8fafc; margin-bottom: 0.2rem;">${mail.subject}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">To: <strong style="color: #cbd5e1;">${mail.to}</strong></div>
          <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 0.6rem; font-size: 0.8rem; color: #cbd5e1; line-height: 1.4; white-space: pre-wrap; font-family: sans-serif; max-height: 120px; overflow-y: auto;">${mail.text}</div>
          ${tokenAction ? `<div style="margin-top: 0.5rem; display: flex; justify-content: flex-end;">${tokenAction}</div>` : ''}
        </div>
      `;
    }).join("");

    // Wire token buttons
    els.mailboxList.querySelectorAll(".btn-use-mail-token").forEach(btn => {
      btn.addEventListener("click", async () => {
        const token = btn.dataset.token;
        const type = btn.dataset.type;
        els.mailboxModal.style.display = "none";
        if (type === "welcome") {
          await verifyEmailWithToken(token);
        } else {
          showAuthModal("reset", token);
        }
      });
    });

  } catch (err) {
    console.error("Failed to load mailbox:", err);
  }
}

async function updateMailboxCount() {
  try {
    const res = await fetch("/api/auth/dev-emails");
    const emails = await res.json();
    if (emails && emails.length > 0 && els.mailboxUnreadCount) {
      els.mailboxUnreadCount.textContent = emails.length;
      els.mailboxUnreadCount.style.display = "inline-block";
    }
  } catch (err) {
    // Silent fail
  }
}

async function verifyEmailWithToken(token) {
  try {
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (res.ok) {
      showToast("🌸 Email verified successfully! ようこそ！", "success");
      await checkAuthStatus();
    } else {
      showToast(data.detail || "Email verification failed.", "error");
    }
  } catch (err) {
    showToast("Network error during verification.", "error");
  }
}

// Global Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  if (e.key === " " && state.activeTab === "learn") {
    // Avoid flipping flashcard if user is typing in an input
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    e.preventDefault();
    state.isCardFlipped = !state.isCardFlipped;
    els.flashcardInner.classList.toggle("flipped", state.isCardFlipped);
  }
  
  if (state.activeTab === "learn" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    if (e.key === "ArrowLeft") els.fcPrevBtn.click();
    if (e.key === "ArrowRight") els.fcNextBtn.click();
  }

  if (state.activeTab === "quiz" && state.session.active) {
    if (!state.isQuizSubmitting && ["1", "2", "3", "4"].includes(e.key)) {
      const idx = parseInt(e.key) - 1;
      const buttons = els.quizOptionsGrid.querySelectorAll(".option-btn");
      if (buttons[idx]) buttons[idx].click();
    }
    if (state.isQuizSubmitting && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      els.quizNextBtn.click();
    }
  }
});

// Init on Load
document.addEventListener("DOMContentLoaded", async () => {
  initNavigation();
  initAuth();
  await checkAuthStatus();
  await loadChaptersList();
  await loadLesson(1);
  refreshReviewBadge();
  updateMailboxCount();

  // Check URL query parameters for reset_token or verify_token
  const params = new URLSearchParams(window.location.search);
  if (params.has("reset_token")) {
    const resetToken = params.get("reset_token");
    showAuthModal("reset", resetToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (params.has("verify_token")) {
    const verifyToken = params.get("verify_token");
    await verifyEmailWithToken(verifyToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
