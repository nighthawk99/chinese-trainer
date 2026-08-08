(() => {
  const SETTINGS_KEY = 'chineseTrainer.settings';
  const DEFAULT_SETTINGS = { pageDurationMs: 3000, vocabSource: 'own', speechRate: 1.0 };

  const VOCAB_SOURCES = {
    own: { label: 'My own vocabulary list', file: 'data/vocab.json' },
    hsk1: { label: 'HSK 1', file: 'data/hsk1.json' },
    hsk2: { label: 'HSK 2', file: 'data/hsk2.json' },
    hsk3: { label: 'HSK 3', file: 'data/hsk3.json' },
    hsk4: { label: 'HSK 4', file: 'data/hsk4.json' },
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  let settings = loadSettings();
  let sourceCountsCache = null;

  const homeScreen = document.getElementById('home-screen');
  const settingsScreen = document.getElementById('settings-screen');
  const trainerScreen = document.getElementById('trainer-screen');
  const completeScreen = document.getElementById('complete-screen');
  const pageContent = document.getElementById('page-content');
  const progressLabel = document.getElementById('progress-label');
  const pauseBtn = document.getElementById('pause-btn');
  const tapZone = document.getElementById('tap-zone');
  const homeModeDesc = document.getElementById('home-mode-desc');
  const durationSlider = document.getElementById('duration-slider');
  const durationValue = document.getElementById('duration-value');
  const rateSlider = document.getElementById('rate-slider');
  const rateValue = document.getElementById('rate-value');
  const vocabSourceList = document.getElementById('vocab-source-list');

  let vocab = [];
  let sessionWords = [];
  let wordIndex = 0;
  let pageIndex = 0; // 0 = hanzi/pinyin, 1 = english, 2 = sentence
  let paused = false;
  let timerId = null;
  let zhVoice = null;
  let enVoice = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showScreen(el) {
    [homeScreen, settingsScreen, trainerScreen, completeScreen].forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  }

  function pickVoices() {
    const voices = window.speechSynthesis.getVoices();
    zhVoice = voices.find(v => v.lang === 'zh-CN') || voices.find(v => v.lang && v.lang.startsWith('zh')) || null;
    enVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang && v.lang.startsWith('en')) || null;
  }

  if ('speechSynthesis' in window) {
    pickVoices();
    window.speechSynthesis.onvoiceschanged = pickVoices;
  }

  function speak(text, lang, voice) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    if (voice) utter.voice = voice;
    utter.rate = settings.speechRate;
    window.speechSynthesis.speak(utter);
  }

  async function fetchWordCount(file) {
    try {
      const res = await fetch(file);
      const data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    } catch (e) {
      return 0;
    }
  }

  async function getSourceCounts() {
    if (sourceCountsCache) return sourceCountsCache;
    const entries = await Promise.all(
      Object.entries(VOCAB_SOURCES).map(async ([key, src]) => [key, await fetchWordCount(src.file)])
    );
    sourceCountsCache = Object.fromEntries(entries);
    return sourceCountsCache;
  }

  async function loadVocab() {
    const source = VOCAB_SOURCES[settings.vocabSource] || VOCAB_SOURCES.own;
    const res = await fetch(source.file);
    vocab = await res.json();
  }

  async function updateHomeDesc() {
    const counts = await getSourceCounts();
    const source = VOCAB_SOURCES[settings.vocabSource] || VOCAB_SOURCES.own;
    const count = counts[settings.vocabSource] || 0;
    homeModeDesc.textContent = `${source.label} — ${count} word${count === 1 ? '' : 's'}, random order`;
  }

  async function renderVocabSourceList() {
    const counts = await getSourceCounts();

    // Guard against a stored selection pointing at an empty/unpopulated source.
    if (!counts[settings.vocabSource]) {
      settings.vocabSource = 'own';
      saveSettings();
    }

    vocabSourceList.innerHTML = '';
    Object.entries(VOCAB_SOURCES).forEach(([key, src]) => {
      const count = counts[key] || 0;
      const disabled = count === 0;
      const selected = settings.vocabSource === key;

      const item = document.createElement('label');
      item.className = 'vocab-source-item' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '');
      item.innerHTML = `
        <input type="radio" name="vocab-source" value="${key}" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <div class="vocab-source-text">
          <div class="vocab-source-name">${src.label}</div>
          <div class="vocab-source-count">${disabled ? 'Coming soon' : count + ' words'}</div>
        </div>
      `;
      if (!disabled) {
        item.querySelector('input').addEventListener('change', () => {
          settings.vocabSource = key;
          saveSettings();
          renderVocabSourceList();
          updateHomeDesc();
        });
      }
      vocabSourceList.appendChild(item);
    });
  }

  function renderDurationSlider() {
    const seconds = settings.pageDurationMs / 1000;
    durationSlider.value = String(seconds);
    durationValue.textContent = seconds.toFixed(1) + 's';
  }

  durationSlider.addEventListener('input', () => {
    const seconds = parseFloat(durationSlider.value);
    durationValue.textContent = seconds.toFixed(1) + 's';
    settings.pageDurationMs = Math.round(seconds * 1000);
    saveSettings();
  });

  function renderRateSlider() {
    rateSlider.value = String(settings.speechRate);
    rateValue.textContent = settings.speechRate.toFixed(1) + '×';
  }

  rateSlider.addEventListener('input', () => {
    const rate = parseFloat(rateSlider.value);
    rateValue.textContent = rate.toFixed(1) + '×';
    settings.speechRate = rate;
    saveSettings();
  });

  async function startSession() {
    await loadVocab();
    sessionWords = shuffle(vocab);
    wordIndex = 0;
    pageIndex = 0;
    paused = false;
    pauseBtn.textContent = '❙❙';
    showScreen(trainerScreen);
    renderPage();
  }

  function updateProgress() {
    progressLabel.textContent = `Word ${wordIndex + 1} / ${sessionWords.length}`;
  }

  function renderPage() {
    clearTimer();
    updateProgress();
    const word = sessionWords[wordIndex];

    if (pageIndex === 0) {
      pageContent.innerHTML = `
        <div class="hanzi-large">${word.hanzi}</div>
        <div class="pinyin-large">${word.pinyin}</div>
      `;
      speak(word.hanzi, 'zh-CN', zhVoice);
    } else if (pageIndex === 1) {
      const [primary, ...rest] = word.translations;
      const altHtml = rest.length
        ? `<div class="english-alt">also: ${rest.join(', ')}</div>`
        : '';
      pageContent.innerHTML = `
        <div class="english-large">${primary}</div>
        ${altHtml}
      `;
      speak(primary, 'en-US', enVoice);
    } else if (pageIndex === 2) {
      pageContent.innerHTML = `
        <div class="sentence-hanzi">${word.example.hanzi}</div>
        <div class="sentence-pinyin">${word.example.pinyin}</div>
        <div class="sentence-english">${word.example.english}</div>
      `;
      speak(word.example.hanzi, 'zh-CN', zhVoice);
    }

    scheduleAutoAdvance();
  }

  function scheduleAutoAdvance() {
    if (paused) return;
    timerId = setTimeout(advance, settings.pageDurationMs);
  }

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function advance() {
    clearTimer();
    if (pageIndex < 2) {
      pageIndex += 1;
      renderPage();
    } else {
      if (wordIndex < sessionWords.length - 1) {
        wordIndex += 1;
        pageIndex = 0;
        renderPage();
      } else {
        endSession();
      }
    }
  }

  function goBack() {
    clearTimer();
    if (pageIndex > 0) {
      pageIndex -= 1;
      renderPage();
    } else if (wordIndex > 0) {
      wordIndex -= 1;
      pageIndex = 2;
      renderPage();
    } else {
      renderPage();
    }
  }

  function endSession() {
    window.speechSynthesis && window.speechSynthesis.cancel();
    document.getElementById('complete-summary').textContent =
      `You reviewed all ${sessionWords.length} words.`;
    showScreen(completeScreen);
  }

  function togglePause() {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '❙❙';
    if (paused) {
      clearTimer();
    } else {
      scheduleAutoAdvance();
    }
  }

  tapZone.addEventListener('click', (e) => {
    const x = e.clientX;
    const width = window.innerWidth;
    if (x < width * 0.3) {
      goBack();
    } else {
      advance();
    }
  });

  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
  });

  document.getElementById('home-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimer();
    window.speechSynthesis && window.speechSynthesis.cancel();
    showScreen(homeScreen);
  });

  document.getElementById('start-vocab-trainer').addEventListener('click', () => {
    startSession();
  });

  document.getElementById('restart-btn').addEventListener('click', () => {
    startSession();
  });

  document.getElementById('complete-home-btn').addEventListener('click', () => {
    showScreen(homeScreen);
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    renderDurationSlider();
    renderRateSlider();
    renderVocabSourceList();
    showScreen(settingsScreen);
  });

  document.getElementById('settings-home-btn').addEventListener('click', () => {
    showScreen(homeScreen);
  });

  renderDurationSlider();
  renderRateSlider();
  updateHomeDesc();
})();
