(() => {
  const SETTINGS_KEY = 'chineseTrainer.settings';
  // pageDurationsMs is indexed by pageIndex: [hanzi/pinyin, english, sentence].
  function defaultSettings() {
    return { pageDurationsMs: [3000, 3000, 3000], vocabSource: 'own', speechRate: 1.0 };
  }

  const VOCAB_SOURCES = {
    own: { label: 'My own vocabulary list', file: 'data/vocab.json' },
    hsk1: { label: 'HSK 1', file: 'data/hsk1.json' },
    hsk2: { label: 'HSK 2', file: 'data/hsk2.json' },
    hsk3: { label: 'HSK 3', file: 'data/hsk3.json' },
    hsk4: { label: 'HSK 4', file: 'data/hsk4.json' },
  };

  function loadSettings() {
    const defaults = defaultSettings();
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      const merged = { ...defaults, ...parsed };
      if (Array.isArray(parsed.pageDurationsMs) && parsed.pageDurationsMs.length === 3) {
        merged.pageDurationsMs = parsed.pageDurationsMs.slice();
      } else if (typeof parsed.pageDurationMs === 'number') {
        // Migrate from the old single per-session duration setting.
        merged.pageDurationsMs = [parsed.pageDurationMs, parsed.pageDurationMs, parsed.pageDurationMs];
      } else {
        merged.pageDurationsMs = defaults.pageDurationsMs.slice();
      }
      delete merged.pageDurationMs;
      return merged;
    } catch (e) {
      return defaults;
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  // Theme normally follows the device's local time of day — 7am-7pm
  // reads as "daytime" for Light, everything else is Dark. The Settings
  // switch can override that, but only in-memory (never saved to
  // settings/localStorage) so it always reverts to automatic next time
  // the app is opened, per the user's explicit request.
  let themeOverride = null; // null = automatic; 'dark' | 'light' = this-session-only override

  function isDaytime() {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19;
  }

  function currentTheme() {
    return themeOverride || (isDaytime() ? 'light' : 'dark');
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme());
  }

  let settings = loadSettings();
  applyTheme();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyTheme();
  });
  setInterval(applyTheme, 5 * 60 * 1000);
  let sourceCountsCache = {}; // keyed by VOCAB_SOURCES key, filled in lazily per source

  const homeScreen = document.getElementById('home-screen');
  const settingsScreen = document.getElementById('settings-screen');
  const trainerScreen = document.getElementById('trainer-screen');
  const completeScreen = document.getElementById('complete-screen');
  const learningScreen = document.getElementById('learning-screen');
  const learningDetailScreen = document.getElementById('learning-detail-screen');
  const learningChapterList = document.getElementById('learning-chapter-list');
  const learningSectionList = document.getElementById('learning-section-list');
  const learningDetailTitle = document.getElementById('learning-detail-title');
  const grammarScreen = document.getElementById('grammar-screen');
  const grammarDetailScreen = document.getElementById('grammar-detail-screen');
  const grammarCategoryList = document.getElementById('grammar-category-list');
  const grammarConstructList = document.getElementById('grammar-construct-list');
  const grammarDetailTitle = document.getElementById('grammar-detail-title');
  const phrasesScreen = document.getElementById('phrases-screen');
  const phrasesDetailScreen = document.getElementById('phrases-detail-screen');
  const phrasesSituationList = document.getElementById('phrases-situation-list');
  const phrasesList = document.getElementById('phrases-list');
  const phrasesDetailTitle = document.getElementById('phrases-detail-title');
  const pageContent = document.getElementById('page-content');
  const progressLabel = document.getElementById('progress-label');
  const pauseBtn = document.getElementById('pause-btn');
  const tapZone = document.getElementById('tap-zone');
  const homeModeDesc = document.getElementById('home-mode-desc');
  const durationSliders = [0, 1, 2].map(i => document.getElementById(`duration-slider-${i}`));
  const durationValues = [0, 1, 2].map(i => document.getElementById(`duration-value-${i}`));
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
  let speechEnded = false; // gates scheduleAutoAdvance until the page's speak() call has finished
  let renderGen = 0; // discards a stale speak() onEnd callback from a page the user has since left
  let navGen = 0; // bumped by every showScreen() — lets an async nav handler detect it's been superseded

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showScreen(el) {
    navGen += 1;
    [homeScreen, settingsScreen, trainerScreen, completeScreen, learningScreen, learningDetailScreen,
     grammarScreen, grammarDetailScreen, phrasesScreen, phrasesDetailScreen].forEach(s => s.classList.remove('active'));
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

  // onEnd fires once, whether speech actually finished, errored, or (if
  // speechSynthesis isn't available at all) never started. The 8s safety
  // timeout covers a real WebKit quirk we've hit before: onend/onerror
  // occasionally never fires at all — without it the trainer would just
  // get stuck on that page forever.
  // Tracks the pending doSpeak() below so stopSpeech() can cancel it —
  // without this, leaving mid-transition (cancel() called while this timer
  // is still pending) let the delayed doSpeak() fire anyway afterward and
  // start new audio on a screen the user had already left.
  let speakDelayTimerId = null;

  function speak(text, lang, voice, onEnd) {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (onEnd) onEnd();
    };
    const doSpeak = () => {
      speakDelayTimerId = null;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      if (voice) utter.voice = voice;
      utter.rate = settings.speechRate;
      utter.onend = finish;
      utter.onerror = finish;
      window.speechSynthesis.speak(utter);
      setTimeout(finish, 8000);
    };
    if (speakDelayTimerId) {
      clearTimeout(speakDelayTimerId);
      speakDelayTimerId = null;
    }
    // Safari (esp. iOS) can silently drop a speak() called in the same tick
    // right after cancel() — only cancel when something's actually playing,
    // and give it one tick to actually stop before queuing the next utterance.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      speakDelayTimerId = setTimeout(doSpeak, 50);
    } else {
      doSpeak();
    }
  }

  // Fully stops audio, including a doSpeak() that speak() may have
  // scheduled but not yet fired — plain speechSynthesis.cancel() alone
  // doesn't prevent that pending call from starting new audio afterward.
  function stopSpeech() {
    if (speakDelayTimerId) {
      clearTimeout(speakDelayTimerId);
      speakDelayTimerId = null;
    }
    window.speechSynthesis && window.speechSynthesis.cancel();
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

  // Cached per source key, not all-or-nothing — the home screen only ever
  // needs the currently-selected source's count, so it shouldn't have to
  // download and parse every other source's full JSON file just to get
  // that one number. Settings still fetches (and caches) the rest, but
  // only once the vocab-source picker is actually opened.
  async function getSourceCount(key) {
    if (sourceCountsCache[key] === undefined) {
      const src = VOCAB_SOURCES[key];
      sourceCountsCache[key] = src ? await fetchWordCount(src.file) : 0;
    }
    return sourceCountsCache[key];
  }

  async function getSourceCounts() {
    const entries = await Promise.all(
      Object.keys(VOCAB_SOURCES).map(async (key) => [key, await getSourceCount(key)])
    );
    return Object.fromEntries(entries);
  }

  async function loadVocab() {
    const source = VOCAB_SOURCES[settings.vocabSource] || VOCAB_SOURCES.own;
    const res = await fetch(source.file);
    vocab = await res.json();
  }

  let learningData = null; // cached data/learning.json, fetched once

  async function loadLearningData() {
    if (!learningData) {
      const res = await fetch('data/learning.json');
      learningData = await res.json();
    }
    return learningData;
  }

  async function renderLearningChapterList() {
    const data = await loadLearningData();
    renderTopicList(learningChapterList, data, 'chapter', openLearningChapter);
  }

  // Unlike Grammar Review's collapsible <details> cards, learning sections
  // render fully expanded — this is meant to be read top-to-bottom like a
  // textbook chapter, not scanned as a reference.
  // Shared by Learning, Grammar Review, and Travel Phrases — all three
  // render a hanzi/pinyin/english example, just inside different wrappers.
  function renderExampleFields(ex) {
    return `
      <div class="example-hanzi">${ex.hanzi}</div>
      <div class="example-pinyin">${ex.pinyin}</div>
      <div class="example-english">${ex.english}</div>
    `;
  }

  function renderExampleList(examples) {
    return '<div class="example-list">' +
      examples.map(ex => `<div class="example">${renderExampleFields(ex)}</div>`).join('') +
      '</div>';
  }

  function renderLearningSection(section) {
    let html = `
      <div class="learning-section">
        <div class="section-header">
          <div class="section-title">${section.title}</div>
          <div class="hsk-badge">HSK ${section.hskLevel}</div>
        </div>
        <div class="theory-block">
          ${section.theory.map(p => `<p class="theory-para">${p}</p>`).join('')}
        </div>
    `;
    if (section.pattern) html += `<div class="pattern-pill">${section.pattern}</div>`;
    html += renderExampleList(section.examples);
    html += '</div>';
    return html;
  }

  function renderLearningChapterDetail(chapterName) {
    learningDetailTitle.textContent = chapterName;
    const sections = learningData.filter(s => s.chapter === chapterName);
    learningSectionList.innerHTML = sections.map(renderLearningSection).join('');
  }

  function openLearningChapter(chapterName) {
    renderLearningChapterDetail(chapterName);
    showScreen(learningDetailScreen);
  }

  let grammarData = null; // cached data/grammar.json, fetched once

  async function loadGrammarData() {
    if (!grammarData) {
      const res = await fetch('data/grammar.json');
      grammarData = await res.json();
    }
    return grammarData;
  }

  // Groups a flat data array by `field`, preserving first-seen order —
  // both grammar.json and phrases.json are pre-ordered by category/
  // situation, so this reproduces the intended display order.
  function groupCounts(data, field) {
    const counts = new Map();
    data.forEach(item => counts.set(item[field], (counts.get(item[field]) || 0) + 1));
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }

  // Shared by Grammar Review's category list and Travel Phrases' situation
  // list — both are "tap a topic to see a detail list" screens.
  function renderTopicList(container, data, field, onSelect) {
    const groups = groupCounts(data, field);
    container.innerHTML = '';
    groups.forEach(({ name, count }) => {
      const btn = document.createElement('button');
      btn.className = 'topic-item';
      btn.innerHTML = `
        <span class="topic-item-name">${name}</span>
        <span class="topic-item-count">${count}</span>
      `;
      btn.addEventListener('click', () => onSelect(name));
      container.appendChild(btn);
    });
  }

  async function renderGrammarCategoryList() {
    const data = await loadGrammarData();
    renderTopicList(grammarCategoryList, data, 'category', openGrammarCategory);
  }

  function renderSubPattern(sp) {
    let html = '<div class="sub-pattern">';
    if (sp.label) html += `<div class="sub-pattern-label">${sp.label}</div>`;
    if (sp.pattern) html += `<div class="pattern-pill">${sp.pattern}</div>`;
    if (sp.explanation) html += `<div class="sub-pattern-explanation">${sp.explanation}</div>`;
    html += renderExampleList(sp.examples);
    html += '</div>';
    return html;
  }

  function renderGrammarConstructList(categoryName) {
    grammarDetailTitle.textContent = categoryName;
    const constructs = grammarData.filter(c => c.category === categoryName);
    grammarConstructList.innerHTML = '';
    constructs.forEach(construct => {
      const card = document.createElement('details');
      card.className = 'construct-card';
      let bodyHtml = construct.subPatterns.map(renderSubPattern).join('');
      if (construct.links && construct.links.length) {
        bodyHtml += '<div class="construct-links">' +
          construct.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('') +
          '</div>';
      }
      card.innerHTML = `<summary>${construct.title}</summary><div class="construct-body">${bodyHtml}</div>`;
      grammarConstructList.appendChild(card);
    });
  }

  function openGrammarCategory(categoryName) {
    renderGrammarConstructList(categoryName);
    showScreen(grammarDetailScreen);
  }

  let phrasesData = null; // cached data/phrases.json, fetched once

  async function loadPhrasesData() {
    if (!phrasesData) {
      const res = await fetch('data/phrases.json');
      phrasesData = await res.json();
    }
    return phrasesData;
  }

  async function renderPhrasesSituationList() {
    const data = await loadPhrasesData();
    renderTopicList(phrasesSituationList, data, 'situation', openPhraseSituation);
  }

  function renderPhrasesList(situationName) {
    phrasesDetailTitle.textContent = situationName;
    const phrases = phrasesData.filter(p => p.situation === situationName);
    phrasesList.innerHTML = phrases.map(p => `
      <div class="phrase-card">
        ${renderExampleFields(p)}
        ${p.note ? `<div class="phrase-note">${p.note}</div>` : ''}
      </div>
    `).join('');
  }

  function openPhraseSituation(situationName) {
    renderPhrasesList(situationName);
    showScreen(phrasesDetailScreen);
  }

  async function updateHomeDesc() {
    const source = VOCAB_SOURCES[settings.vocabSource] || VOCAB_SOURCES.own;
    const count = await getSourceCount(settings.vocabSource);
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

  function renderDurationSliders() {
    settings.pageDurationsMs.forEach((ms, i) => {
      const seconds = ms / 1000;
      durationSliders[i].value = String(seconds);
      durationValues[i].textContent = seconds.toFixed(1) + 's';
    });
  }

  durationSliders.forEach((slider, i) => {
    slider.addEventListener('input', () => {
      const seconds = parseFloat(slider.value);
      durationValues[i].textContent = seconds.toFixed(1) + 's';
      settings.pageDurationsMs[i] = Math.round(seconds * 1000);
      saveSettings();
    });
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

  const themeSwitch = document.getElementById('theme-switch');

  function renderThemeToggle() {
    themeSwitch.setAttribute('aria-checked', String(currentTheme() === 'light'));
  }

  themeSwitch.addEventListener('click', () => {
    themeOverride = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme();
    renderThemeToggle();
  });

  // iOS Safari (especially an installed Home Screen app) only allows
  // speechSynthesis.speak() unprompted for a brief window after a real user
  // gesture. startSession() is async (awaits a vocab fetch before the first
  // speak() call), which can outlast that window, and every later speak()
  // during auto-advance is timer-driven with no gesture at all. Speaking a
  // near-silent utterance synchronously inside the click handler "unlocks"
  // audio for the rest of the session.
  function primeSpeechSynthesis() {
    if (!('speechSynthesis' in window)) return;
    const primer = new SpeechSynthesisUtterance(' ');
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
  }

  async function startSession() {
    await loadVocab();
    if (!vocab.length) {
      // Guards against a stored vocabSource pointing at a source that's
      // since become empty (e.g. an in-progress HSK level) — the same
      // fallback renderVocabSourceList applies, but that only runs when
      // Settings is opened, not when jumping straight into a session.
      settings.vocabSource = 'own';
      saveSettings();
      updateHomeDesc(); // keep the home tile's subtitle in sync with the corrected source
      await loadVocab();
    }
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

    speechEnded = false;
    renderGen += 1;
    const myGen = renderGen;
    const onSpeechEnd = () => {
      if (myGen !== renderGen) return; // stale — user has since moved to another page
      speechEnded = true;
      scheduleAutoAdvance();
    };

    if (pageIndex === 0) {
      pageContent.innerHTML = `
        <div class="hanzi-large">${word.hanzi}</div>
        <div class="pinyin-large">${word.pinyin}</div>
      `;
      speak(word.hanzi, 'zh-CN', zhVoice, onSpeechEnd);
    } else if (pageIndex === 1) {
      const [primary, ...rest] = word.translations;
      const altHtml = rest.length
        ? `<div class="english-alt">also: ${rest.join(', ')}</div>`
        : '';
      pageContent.innerHTML = `
        <div class="english-large">${primary}</div>
        ${altHtml}
      `;
      speak(primary, 'en-US', enVoice, onSpeechEnd);
    } else if (pageIndex === 2) {
      pageContent.innerHTML = `
        <div class="sentence-hanzi">${word.example.hanzi}</div>
        <div class="sentence-pinyin">${word.example.pinyin}</div>
        <div class="sentence-english">${word.example.english}</div>
      `;
      speak(word.example.hanzi, 'zh-CN', zhVoice, onSpeechEnd);
    }

    fitContentToContainer();
  }

  // Pure CSS (vmin/clamp) sizes text off viewport dimensions alone, which
  // can't account for how many characters are in a given word or sentence
  // — a long word on a narrow phone can overflow. Shrink --fit-scale (a
  // multiplier on every font-size in page-content) only as much as needed
  // so the whole page always fits, starting from full size each time.
  // The hanzi word (page 0) has `white-space: nowrap` in CSS so it can
  // never wrap onto a second line — its width is checked here too, so
  // it shrinks as needed to stay on one row instead of overflowing.
  function fitContentToContainer() {
    pageContent.style.setProperty('--fit-scale', '1');
    let scale = 1;
    const maxHeight = tapZone.clientHeight;
    const maxWidth = tapZone.clientWidth;
    const hanziEl = pageContent.querySelector('.hanzi-large');
    const fits = () =>
      pageContent.scrollHeight <= maxHeight &&
      (!hanziEl || hanziEl.scrollWidth <= maxWidth);
    // A handful of vocab.json entries are grammar-pattern strings rather
    // than real single words (e.g. "S + 比 + S + 大/小 + number + 岁"),
    // long enough to need a much smaller floor than any real word does
    // to fit on one row. overflow-x on the tap zone is the last-resort
    // safety net if even this floor isn't enough.
    while (!fits() && scale > 0.1) {
      scale = Math.round((scale - 0.05) * 100) / 100;
      pageContent.style.setProperty('--fit-scale', String(scale));
    }
  }

  function scheduleAutoAdvance() {
    // Waits for the page's speech to finish (speechEnded, set by renderPage's
    // onSpeechEnd callback) before starting the per-page timer — called again
    // from there once speech ends if this no-ops here for that reason.
    if (paused || !speechEnded) return;
    timerId = setTimeout(advance, settings.pageDurationsMs[pageIndex]);
  }

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  // Neither branch below needs its own clearTimer() — renderPage() and
  // endSession() (the only two things either function can lead to) each
  // clear it themselves, so every path is covered at its actual endpoint.
  function advance() {
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
    clearTimer();
    stopSpeech();
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

  // Tap-zone interaction: a quick tap navigates (left 30% = back, rest =
  // forward). Holding a finger down pauses the page-turn timer for as long
  // as it's held; releasing quickly resumes automatically (unless the
  // pause button has explicitly paused things, which scheduleAutoAdvance
  // already respects). Pointer events (not click) so real touch-hold
  // duration can be measured.
  const TAP_MAX_DURATION_MS = 300;
  const TAP_MAX_MOVEMENT_PX = 10;
  let holdActive = false;
  let holdStartTime = 0;
  let holdStartX = 0;

  tapZone.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    holdActive = true;
    holdStartTime = Date.now();
    holdStartX = e.clientX;
    clearTimer();
  });

  function endHold(e) {
    if (!holdActive) return;
    holdActive = false;
    const duration = Date.now() - holdStartTime;
    const moved = Math.abs((e.clientX ?? holdStartX) - holdStartX);
    if (duration < TAP_MAX_DURATION_MS && moved < TAP_MAX_MOVEMENT_PX) {
      const width = window.innerWidth;
      if (holdStartX < width * 0.3) {
        goBack();
      } else {
        advance();
      }
    } else {
      scheduleAutoAdvance();
    }
  }

  tapZone.addEventListener('pointerup', endHold);
  tapZone.addEventListener('pointercancel', () => {
    holdActive = false;
    scheduleAutoAdvance();
  });

  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
  });

  document.getElementById('home-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimer();
    stopSpeech();
    showScreen(homeScreen);
  });

  document.getElementById('start-vocab-trainer').addEventListener('click', () => {
    primeSpeechSynthesis();
    startSession();
  });

  document.getElementById('start-learning').addEventListener('click', async () => {
    const myNav = navGen;
    await renderLearningChapterList();
    if (navGen !== myNav) return; // user navigated elsewhere while this loaded
    showScreen(learningScreen);
  });

  document.getElementById('learning-home-btn').addEventListener('click', () => {
    showScreen(homeScreen);
  });

  document.getElementById('learning-detail-back-btn').addEventListener('click', () => {
    showScreen(learningScreen);
  });

  document.getElementById('start-grammar-review').addEventListener('click', async () => {
    const myNav = navGen;
    await renderGrammarCategoryList();
    if (navGen !== myNav) return; // user navigated elsewhere while this loaded
    showScreen(grammarScreen);
  });

  document.getElementById('grammar-home-btn').addEventListener('click', () => {
    showScreen(homeScreen);
  });

  document.getElementById('grammar-detail-back-btn').addEventListener('click', () => {
    showScreen(grammarScreen);
  });

  document.getElementById('start-travel-phrases').addEventListener('click', async () => {
    const myNav = navGen;
    await renderPhrasesSituationList();
    if (navGen !== myNav) return; // user navigated elsewhere while this loaded
    showScreen(phrasesScreen);
  });

  document.getElementById('phrases-home-btn').addEventListener('click', () => {
    showScreen(homeScreen);
  });

  document.getElementById('phrases-detail-back-btn').addEventListener('click', () => {
    showScreen(phrasesScreen);
  });

  document.getElementById('restart-btn').addEventListener('click', () => {
    primeSpeechSynthesis();
    startSession();
  });

  document.getElementById('complete-home-btn').addEventListener('click', () => {
    showScreen(homeScreen);
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    renderDurationSliders();
    renderRateSlider();
    renderThemeToggle();
    renderVocabSourceList();
    showScreen(settingsScreen);
  });

  document.getElementById('settings-home-btn').addEventListener('click', () => {
    showScreen(homeScreen);
  });

  renderDurationSliders();
  renderRateSlider();
  updateHomeDesc();

  // Offline mode: precaches the app + all data files on first load so
  // Vocabulary Trainer / Grammar Review / Travel Phrases keep working
  // with no signal (see sw.js for the caching strategy/rationale).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
