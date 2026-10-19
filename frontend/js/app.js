// KotobaMaster Application Logic (Minna no Nihongo & AHA Lab Learn/Review Architecture)

const state = {
  activeTab: "learn",
  selectedLesson: 1,
  chapters: [],
  chapterWords: [],
  currentCardIndex: 0,
  isCardFlipped: false,
  reviewQueueCount: 0,
  
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
  sessionSizeSelect: document.getElementById("session-size-select"),
  startSessionBtn: document.getElementById("start-session-btn"),
  startPracticeBtn: document.getElementById("start-practice-btn"),

  // Active Quiz
  quizProgressIndicator: document.getElementById("quiz-progress-indicator"),
  quizSessionTypeBadge: document.getElementById("quiz-session-type-badge"),
  quizStreakDisplay: document.getElementById("quiz-streak-display"),
  quitSessionBtn: document.getElementById("quit-session-btn"),
  
  quizLessonBadge: document.getElementById("quiz-lesson-badge"),
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
  unlockModalCloseBtn: document.getElementById("unlock-modal-close-btn")
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
    const res = await fetch("/api/chapters");
    state.chapters = await res.json();
    
    els.chapterSelect.innerHTML = "";
    state.chapters.forEach(chap => {
      const opt = document.createElement("option");
      opt.value = chap.lesson_number;
      opt.textContent = `${chap.is_unlocked ? "🔓" : "🔒"} ${chap.title}`;
      if (!chap.is_unlocked) opt.disabled = true;
      els.chapterSelect.appendChild(opt);
    });
    
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
    const res = await fetch(`/api/chapters/${lessonNumber}/words`);
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
    await fetch("/api/chapters/toggle-review", {
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
    const res = await fetch(`/api/chapters/${state.selectedLesson}/add-all-to-review`, { method: "POST" });
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

  try {
    const res = await fetch("/api/quiz/status");
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
  
  try {
    const res = await fetch(`/api/quiz/session?size=${size}`);
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
  
  els.quizLessonBadge.textContent = `Lesson ${q.lesson_number}`;
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
    const res = await fetch("/api/quiz/submit", {
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
    const res = await fetch("/api/chapters");
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
    const res = await fetch("/api/decks/summary");
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
    const res = await fetch("/api/quiz/status");
    const data = await res.json();
    els.reviewBadgeCount.textContent = data.due_count || 0;
  } catch (err) {}
}

if (els.resetBtn) {
  els.resetBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset all progress, star ratings, and review queues?")) return;
    await fetch("/api/decks/reset", { method: "POST" });
    loadAnalytics();
    refreshReviewBadge();
    loadLesson(state.selectedLesson);
    alert("Progress successfully reset!");
  });
}

// Global Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  if (e.key === " " && state.activeTab === "learn") {
    e.preventDefault();
    state.isCardFlipped = !state.isCardFlipped;
    els.flashcardInner.classList.toggle("flipped", state.isCardFlipped);
  }
  
  if (state.activeTab === "learn") {
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
  await loadChaptersList();
  await loadLesson(1);
  refreshReviewBadge();
});
