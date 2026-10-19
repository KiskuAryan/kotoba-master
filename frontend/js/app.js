// KotobaMaster Application Logic (Minna no Nihongo & AHA Lab Learn/Review Architecture)

const state = {
  activeTab: "learn",
  selectedLesson: 1,
  chapters: [],
  chapterWords: [],
  currentCardIndex: 0,
  isCardFlipped: false,
  reviewQueueCount: 0,
  
  // Quiz
  currentQuizQuestion: null,
  recentQuizIds: [],
  isQuizSubmitting: false,
  totalAnsweredSession: 0,
  streakCount: 0
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

  // Review Mode
  quizStreakDisplay: document.getElementById("quiz-streak-display"),
  quizQueueCount: document.getElementById("quiz-queue-count"),
  sessionCount: document.getElementById("session-count"),
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

// --- Speech Synthesis (Japanese TTS) ---
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
  if (tabName === "quiz") fetchNextQuizQuestion();
  if (tabName === "roadmap") loadRoadmap();
  if (tabName === "analytics") loadAnalytics();
}

// --- Helper: Render 5 Stars ---
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
    
    // Update Chapter Selector Dropdown
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
    
    // Update Chapter Info & Header
    const currentChap = state.chapters.find(c => c.lesson_number === lessonNumber);
    const masteryPct = currentChap ? currentChap.mastery_percentage : 0;
    els.learnMasteryFill.style.width = `${masteryPct}%`;
    els.learnMasteryText.textContent = `${masteryPct}%`;

    els.chapterListTitle = document.getElementById("chapter-list-title");
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
  
  // Front
  els.fcLessonBadge.textContent = `Lesson ${word.lesson_number}`;
  els.fcKanji.textContent = word.kanji || word.kana;
  els.fcKana.textContent = word.kanji ? word.kana : "";
  els.fcRomaji.textContent = word.romaji;
  
  // Back
  els.fcPosBadge.textContent = word.part_of_speech;
  els.fcMeaning.textContent = word.meaning;
  els.fcExampleJa.textContent = word.example_ja || "—";
  els.fcExampleEn.textContent = word.example_en || "";

  // Indicators & Review Status
  els.fcIndexIndicator.textContent = `Word ${index + 1} of ${state.chapterWords.length}`;
  
  const inReview = word.progress && word.progress.is_in_review;
  updateReviewToggleBtnState(inReview);

  // Audio button
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

// Flashcard Controls
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
    const res = await fetch("/api/chapters/toggle-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word_id: word.id, is_in_review: newStatus })
    });
    const data = await res.json();
    
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
    
    // Update local state
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

    // Click on row to view in flashcard
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

// ==================== 2. REVIEW MODE (5-STAR MCQ) ====================
async function fetchNextQuizQuestion() {
  state.isQuizSubmitting = false;
  els.quizFeedbackCard.style.display = "none";
  if (els.aiBox) els.aiBox.style.display = "none";
  if (els.aiExplainBtn) {
    els.aiExplainBtn.disabled = false;
    els.aiExplainBtn.textContent = "✨ AI Context & Mnemonic";
  }

  els.quizOptionsGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); padding: 2rem;">Loading next review card...</div>`;

  try {
    let url = `/api/quiz/next?only_in_review=true`;
    if (state.recentQuizIds.length > 0) {
      url += `&exclude=${state.recentQuizIds.slice(-5).join(",")}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json();
      if (res.status === 404 && errData.detail && errData.detail.includes("EMPTY_REVIEW_QUEUE")) {
        renderEmptyReviewState();
        return;
      }
      throw new Error("Failed to load question");
    }

    const q = await res.json();
    state.currentQuizQuestion = q;
    state.recentQuizIds.push(q.word_id);
    if (state.recentQuizIds.length > 10) state.recentQuizIds.shift();

    renderQuizQuestion(q);
    refreshReviewBadge();
  } catch (err) {
    els.quizOptionsGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--accent-red); padding: 1.5rem;">Error loading review question.</div>`;
  }
}

function renderEmptyReviewState() {
  els.quizPromptKanji.textContent = "🌱";
  els.quizPromptKana.textContent = "Review Queue is Empty";
  els.quizPromptRomaji.textContent = "Start by learning vocabulary!";
  els.quizStarRating.innerHTML = "";
  els.quizLessonBadge.textContent = "Step 1";
  els.quizPosBadge.textContent = "Guide";
  els.quizAudioBtn.style.display = "none";

  els.quizOptionsGrid.innerHTML = `
    <div style="grid-column: span 2; background: var(--bg-card); border: 1px dashed var(--accent-blue); border-radius: 12px; padding: 2rem; text-align: center;">
      <h3 style="font-size: 1.15rem; color: #fff; margin-bottom: 0.5rem;">No words in your review queue yet!</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
        Following the Minna no Nihongo curriculum, first study Lesson 1 flashcards and click <strong>"Add to Review Queue"</strong>.
      </p>
      <button class="btn-primary" style="margin: 0 auto;" onclick="switchTab('learn')">
        📖 Go to Learn Section →
      </button>
    </div>
  `;
}

function renderQuizQuestion(q) {
  els.quizAudioBtn.style.display = "inline-flex";
  els.quizPromptKanji.textContent = q.prompt_kanji || q.prompt_kana;
  els.quizPromptKana.textContent = q.prompt_kanji ? q.prompt_kana : "";
  els.quizPromptRomaji.textContent = q.romaji;
  
  els.quizLessonBadge.textContent = `Lesson ${q.lesson_number}`;
  els.quizPosBadge.textContent = q.part_of_speech;
  els.quizStarRating.innerHTML = renderStarIcons(q.current_stars);

  els.quizOptionsGrid.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span>${opt}</span><span class="option-key">${idx + 1}</span>`;
    btn.addEventListener("click", () => handleQuizSubmit(opt, btn));
    els.quizOptionsGrid.appendChild(btn);
  });

  els.quizAudioBtn.onclick = () => playJapaneseAudio(q.prompt_kanji || q.prompt_kana);
}

async function handleQuizSubmit(selectedOption, clickedBtn) {
  if (state.isQuizSubmitting || !state.currentQuizQuestion) return;
  state.isQuizSubmitting = true;

  const buttons = els.quizOptionsGrid.querySelectorAll(".option-btn");
  buttons.forEach(b => b.disabled = true);

  try {
    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word_id: state.currentQuizQuestion.word_id,
        selected_option: selectedOption
      })
    });

    const result = await res.json();
    state.totalAnsweredSession++;
    els.sessionCount.textContent = state.totalAnsweredSession;
    state.streakCount = result.correct_streak;
    els.quizStreakDisplay.textContent = `🔥 ${result.correct_streak} Streak`;

    buttons.forEach(btn => {
      const text = btn.querySelector("span").textContent;
      if (text.toLowerCase() === result.correct_meaning.toLowerCase()) {
        btn.classList.add("correct");
      } else if (btn === clickedBtn && !result.is_correct) {
        btn.classList.add("incorrect");
      }
    });

    if (result.is_correct) {
      playJapaneseAudio(state.currentQuizQuestion.prompt_kanji || state.currentQuizQuestion.prompt_kana);
    }

    showQuizFeedback(result);

    // Check if new chapter unlocked!
    if (result.chapter_unlocked) {
      triggerUnlockCelebration(result.chapter_unlocked);
    }
  } catch (err) {
    console.error("Error submitting answer:", err);
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

  els.quizNextBtn.onclick = () => fetchNextQuizQuestion();
  els.quizNextBtn.focus();

  // AI Handler
  if (els.aiExplainBtn) {
    els.aiExplainBtn.onclick = async () => {
      els.aiExplainBtn.disabled = true;
      els.aiExplainBtn.textContent = "⏳ Generating AI Context...";
      try {
        const res = await fetch("/api/ai/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: state.currentQuizQuestion.prompt_kanji || state.currentQuizQuestion.prompt_kana,
            kana: state.currentQuizQuestion.prompt_kana,
            meaning: result.correct_meaning,
            level: state.currentQuizQuestion.jlpt_level
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

// Celebration Modal
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

// ==================== 4. ANALYTICS & UTILS ====================
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
    const res = await fetch("/api/decks/summary");
    const data = await res.json();
    els.reviewBadgeCount.textContent = data.words_in_review || 0;
    els.quizQueueCount.textContent = data.words_in_review || 0;
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
  // Space flips card in Learn mode, or advances quiz feedback in Quiz mode
  if (e.key === " " && state.activeTab === "learn") {
    e.preventDefault();
    state.isCardFlipped = !state.isCardFlipped;
    els.flashcardInner.classList.toggle("flipped", state.isCardFlipped);
  }
  
  if (state.activeTab === "learn") {
    if (e.key === "ArrowLeft") els.fcPrevBtn.click();
    if (e.key === "ArrowRight") els.fcNextBtn.click();
  }

  if (state.activeTab === "quiz") {
    if (!state.isQuizSubmitting && ["1", "2", "3", "4"].includes(e.key)) {
      const idx = parseInt(e.key) - 1;
      const buttons = els.quizOptionsGrid.querySelectorAll(".option-btn");
      if (buttons[idx]) buttons[idx].click();
    }
    if (state.isQuizSubmitting && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      fetchNextQuizQuestion();
    }
  }
});

// App Initialization
document.addEventListener("DOMContentLoaded", async () => {
  initNavigation();
  await loadChaptersList();
  await loadLesson(1);
  refreshReviewBadge();
});
