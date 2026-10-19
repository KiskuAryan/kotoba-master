// Web Speech API utility for Japanese pronunciation

export function speakJapanese(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.88; // Slightly slower for crisp learner clarity
  utterance.pitch = 1.0;

  // Try finding a natural Japanese voice
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(
    (v) => v.lang.startsWith('ja') || v.lang.includes('JP') || v.name.toLowerCase().includes('japanese')
  );
  if (jaVoice) {
    utterance.voice = jaVoice;
  }

  window.speechSynthesis.speak(utterance);
}
