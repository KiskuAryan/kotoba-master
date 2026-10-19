// KotobaMaster Frontend Application Logic

const state = {
  activeTab: "quiz",
  currentLevel: null,  // null = all, "N5", or "N4"
  currentQuestion: null,
  recentWordIds: [],
  isSubmitting: false,
  totalAnsweredSession: 0,
  streakCount: 0
};

// --- DOM References ---
const els = {
  tabBtns: document.querySelectorAll(".tab-btn"),
  pillBtns: document.querySelectorAll(".pill-btn"),
  views: document.querySelectorAll(".view-section"),
  
  // Quiz
  promptKanji: document.getElementById("prompt-kanji"),
  promptKana: document.getElementById("prompt-kana"),
  promptRomaji: document.getElementById("prompt-romaji"),
  levelBadge: document.getElementById("level-badge"),
  posBadge: document.getElementById("pos-badge"),
  starRating: document.getElementById("star-rating"),
  optionsGrid: document.getElementById("options-grid"),
  audioBtn: document.getElementById("audio-btn"),
  feedbackCard: document.getElementById("feedback-card"),
  feedbackStatus: document.getElementById("feedback-status"),
  feedbackChange: document.getElementById("feedback-change"),
  exampleJa: document.getElementById("example-ja"),
  exampleEn: document.getElementById("example-en"),
  nextBtn: document.getElementById("next-btn"),
  streakDisplay: document.getElementById("streak-display"),
  sessionCount: document.getElementById("session-count"),
  aiBox: document.getElementById("ai-box"),
  aiExplainBtn: document.getElementById("ai-explain-btn"),
  aiSentence: document.getElementById("ai-sentence"),
  aiRomaji: document.getElementById("ai-romaji"),
  aiTranslation: document.getElementById("ai-translation"),
  aiGrammar: document.getElementById("ai-grammar"),
  aiMnemonic: document.getElementById("ai-mnemonic"),
  aiSourceBadge: document.getElementById("ai-source-badge"),

  // Browser
  searchInput: document.getElementById("search-input"),
  wordsGrid: document.getElementById("words-grid"),
  starFilter: document.getElementById("star-filter"),

  // Analytics
  metricTotal: document.getElementById("metric-total"),
  metricMastered: document.getElementById("metric-mastered"),
  metricLearning: document.getElementById("metric-learning"),
  metricAccuracy: document.getElementById("metric-accuracy"),
  starBarsContainer: document.getElementById("star-bars-container"),
  resetBtn: document.getElementById("reset-btn")
};

// --- Speech Synthesis (Japanese TTS) ---
function playJapaneseAudio(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.9; // Slightly slower for clarity
  window.speechSynthesis.speak(utterance);
}

// --- Navigation & Tabs ---
function initNavigation() {
  els.tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      els.tabBtns.forEach(b => b.classList.remove("active"));
      els.views.forEach(v => v.classList.remove("active"));
      
      btn.classList.add("active");
      const targetView = document.getElementById(`${btn.dataset.tab}-view`);
      if (targetView) targetView.classList.add("active");
      
      state.activeTab = btn.dataset.tab;
      if (state.activeTab === "browse") loadWordDeck();
      if (state.activeTab === "analytics") loadAnalytics();
    });
  });

  els.pillBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      els.pillBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.currentLevel = btn.dataset.level === "all" ? null : btn.dataset.level;

      if (state.activeTab === "quiz") fetchNextQuestion();
      if (state.activeTab === "browse") loadWordDeck();
      if (state.activeTab === "analytics") loadAnalytics();
    });
  });
}

// --- Helper: Render 5 Stars ---
function renderStarIcons(starCount) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= starCount) {
      html += `<span class="star-filled">★</span>`;
    } else {
      html += `<span class="star-empty">☆</span>`;
    }
  }
  return html;
}

// --- QUIZ GAME ENGINE ---
async function fetchNextQuestion() {
  state.isSubmitting = false;
  els.feedbackCard.style.display = "none";
  if (els.aiBox) els.aiBox.style.display = "none";
  if (els.aiExplainBtn) {
    els.aiExplainBtn.disabled = false;
    els.aiExplainBtn.textContent = "✨ AI Context & Mnemonic";
  }
  els.optionsGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); padding: 1rem;">Loading next vocabulary word...</div>`;

  try {
    let url = `/api/quiz/next`;
    const params = [];
    if (state.currentLevel) params.push(`level=${state.currentLevel}`);
    if (state.recentWordIds.length > 0) params.push(`exclude=${state.recentWordIds.slice(-5).join(",")}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load question");
    const q = await res.json();
    state.currentQuestion = q;

    // Track recently presented words
    state.recentWordIds.push(q.word_id);
    if (state.recentWordIds.length > 10) state.recentWordIds.shift();

    renderQuestion(q);
  } catch (err) {
    els.optionsGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--accent-red); padding: 1rem;">Error loading question. Please check backend connection.</div>`;
  }
}

function renderQuestion(q) {
  els.promptKanji.textContent = q.prompt_kanji || q.prompt_kana;
  els.promptKana.textContent = q.prompt_kanji ? q.prompt_kana : "";
  els.promptRomaji.textContent = q.romaji;
  
  els.levelBadge.textContent = q.jlpt_level;
  els.levelBadge.className = `badge badge-${q.jlpt_level.toLowerCase()}`;
  els.posBadge.textContent = q.part_of_speech;

  els.starRating.innerHTML = renderStarIcons(q.current_stars);

  // Render Options
  els.optionsGrid.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span>${opt}</span><span class="option-key">${idx + 1}</span>`;
    btn.addEventListener("click", () => handleAnswerSubmit(opt, btn));
    els.optionsGrid.appendChild(btn);
  });

  // Audio Handler
  els.audioBtn.onclick = () => playJapaneseAudio(q.prompt_kanji || q.prompt_kana);
}

async function handleAnswerSubmit(selectedOption, clickedBtn) {
  if (state.isSubmitting || !state.currentQuestion) return;
  state.isSubmitting = true;

  // Disable all option buttons
  const buttons = els.optionsGrid.querySelectorAll(".option-btn");
  buttons.forEach(b => b.disabled = true);

  try {
    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word_id: state.currentQuestion.word_id,
        selected_option: selectedOption
      })
    });

    const result = await res.json();
    state.totalAnsweredSession++;
    els.sessionCount.textContent = state.totalAnsweredSession;

    // Update streak
    state.streakCount = result.correct_streak;
    els.streakDisplay.textContent = `🔥 ${result.correct_streak}`;

    // Highlight buttons
    buttons.forEach(btn => {
      const text = btn.querySelector("span").textContent;
      if (text.toLowerCase() === result.correct_meaning.toLowerCase()) {
        btn.classList.add("correct");
      } else if (btn === clickedBtn && !result.is_correct) {
        btn.classList.add("incorrect");
      }
    });

    // Audio on correct
    if (result.is_correct) {
      playJapaneseAudio(state.currentQuestion.prompt_kanji || state.currentQuestion.prompt_kana);
    }

    // Render Feedback
    showFeedback(result);
  } catch (err) {
    console.error("Error submitting answer:", err);
  }
}

function showFeedback(result) {
  els.feedbackCard.style.display = "block";
  
  if (result.is_correct) {
    els.feedbackStatus.innerHTML = `<span class="feedback-status correct">✓ Correct Recall!</span>`;
  } else {
    els.feedbackStatus.innerHTML = `<span class="feedback-status incorrect">✗ Incorrect (Correct: ${result.correct_meaning})</span>`;
  }

  // Star Change Pill
  let pillClass = "change-same";
  let changeText = `⭐ ${result.star_rating_before} → ⭐ ${result.star_rating_after}`;
  if (result.star_change > 0) {
    pillClass = "change-plus";
    changeText += ` (+${result.star_change} Star)`;
  } else if (result.star_change < 0) {
    pillClass = "change-minus";
    changeText += ` (${result.star_change} Stars)`;
  }
  els.feedbackChange.className = `feedback-change-pill ${pillClass}`;
  els.feedbackChange.textContent = changeText;

  // Example sentences
  if (result.example_ja) {
    els.exampleJa.textContent = result.example_ja;
    els.exampleEn.textContent = result.example_en || "";
  } else {
    els.exampleJa.textContent = "—";
    els.exampleEn.textContent = "";
  }

  // Focus next button
  els.nextBtn.onclick = () => fetchNextQuestion();
  els.nextBtn.focus();

  // AI Explanation handler
  if (els.aiExplainBtn) {
    els.aiExplainBtn.onclick = async () => {
      els.aiExplainBtn.disabled = true;
      els.aiExplainBtn.textContent = "⏳ Generating AI Context...";
      try {
        const res = await fetch("/api/ai/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: state.currentQuestion.prompt_kanji || state.currentQuestion.prompt_kana,
            kana: state.currentQuestion.prompt_kana,
            meaning: result.correct_meaning,
            level: state.currentQuestion.jlpt_level
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

// --- KEYBOARD SHORTCUTS ---
window.addEventListener("keydown", (e) => {
  if (state.activeTab !== "quiz") return;

  // Keys 1 to 4 select options
  if (!state.isSubmitting && ["1", "2", "3", "4"].includes(e.key)) {
    const idx = parseInt(e.key) - 1;
    const buttons = els.optionsGrid.querySelectorAll(".option-btn");
    if (buttons[idx]) buttons[idx].click();
  }

  // Enter or Space moves to next question when feedback is open
  if (state.isSubmitting && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    fetchNextQuestion();
  }
});

// --- DECK BROWSER ---
async function loadWordDeck() {
  els.wordsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">Loading vocabulary...</div>`;
  try {
    let url = `/api/words?limit=100`;
    if (state.currentLevel) url += `&level=${state.currentLevel}`;
    if (els.searchInput.value.trim()) url += `&search=${encodeURIComponent(els.searchInput.value.trim())}`;
    if (els.starFilter.value) url += `&stars=${els.starFilter.value}`;

    const res = await fetch(url);
    const words = await res.json();

    if (words.length === 0) {
      els.wordsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No words found matching criteria.</div>`;
      return;
    }

    els.wordsGrid.innerHTML = "";
    words.forEach(w => {
      const card = document.createElement("div");
      card.className = "word-card";
      const stars = w.progress ? w.progress.star_rating : 1;
      const streak = w.progress ? w.progress.correct_streak : 0;
      const total = w.progress ? w.progress.total_attempts : 0;

      card.innerHTML = `
        <div>
          <div class="word-card-top">
            <span class="badge badge-${w.jlpt_level.toLowerCase()}">${w.jlpt_level}</span>
            <div class="star-rating-display">${renderStarIcons(stars)}</div>
          </div>
          <div class="word-card-kanji">${w.kanji || w.kana}</div>
          <div class="word-card-kana">${w.kanji ? w.kana : w.romaji}</div>
          <div class="word-card-meaning">${w.meaning}</div>
        </div>
        <div class="word-card-footer">
          <span>Streak: 🔥 ${streak} (Done: ${total})</span>
          <button class="audio-btn" style="padding: 0.2rem 0.5rem; margin: 0;" onclick="playJapaneseAudio('${w.kanji || w.kana}')">🔊</button>
        </div>
      `;
      els.wordsGrid.appendChild(card);
    });
  } catch (err) {
    els.wordsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--accent-red);">Failed to load deck.</div>`;
  }
}

if (els.searchInput) {
  els.searchInput.addEventListener("input", debounce(() => loadWordDeck(), 300));
}
if (els.starFilter) {
  els.starFilter.addEventListener("change", () => loadWordDeck());
}

function debounce(func, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
}

// --- ANALYTICS VIEW ---
async function loadAnalytics() {
  try {
    let url = `/api/decks/summary`;
    if (state.currentLevel) url += `?level=${state.currentLevel}`;
    const res = await fetch(url);
    const data = await res.json();

    els.metricTotal.textContent = data.total_words;
    els.metricMastered.textContent = data.mastered_count;
    els.metricLearning.textContent = data.learning_count + data.familiar_count;
    els.metricAccuracy.textContent = `${data.overall_accuracy}%`;

    // Render Star Bars
    els.starBarsContainer.innerHTML = "";
    const total = data.total_words || 1;
    for (let s = 5; s >= 1; s--) {
      const count = data.star_distribution[s] || 0;
      const pct = Math.round((count / total) * 100);

      const row = document.createElement("div");
      row.className = "star-bar-row";
      row.innerHTML = `
        <div class="star-bar-label">${renderStarIcons(s)}</div>
        <div class="star-bar-track">
          <div class="star-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="star-bar-count">${count} (${pct}%)</div>
      `;
      els.starBarsContainer.appendChild(row);
    }
  } catch (err) {
    console.error("Error loading analytics:", err);
  }
}

// Reset Progress
if (els.resetBtn) {
  els.resetBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset your vocabulary mastery ratings back to 1 Star?")) return;
    let url = "/api/decks/reset";
    if (state.currentLevel) url += `?level=${state.currentLevel}`;
    await fetch(url, { method: "POST" });
    loadAnalytics();
    if (state.activeTab === "quiz") fetchNextQuestion();
  });
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  fetchNextQuestion();
});
