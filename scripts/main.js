/* ─────────────────────────────────────────────────────────────────
 *  morsed — Morse code practice with real words & sentences
 * ───────────────────────────────────────────────────────────────── */

/* ── Word bank ───────────────────────────────────────────────────
 *  Common English words organised by length. Enough variety that
 *  every session feels fresh.
 * ────────────────────────────────────────────────────────────────── */
const WORDS = {
  /* Short (≤4 chars) */
  short: [
    "the","and","for","are","but","not","you","all","can","had",
    "her","was","one","our","out","has","see","its","now","get",
    "him","how","did","say","she","too","may","try","use",
    "let","ask","run","big","old","set","put","end","far","got",
    "yet","own","two","way","who","why","new","any","day","man",
    "men","few","red","bed","box","car","dog","eye","fox","gun",
    "hat","ice","jar","key","leg","map","net","oak","pen","sea",
    "tea","van","win",
  ],
  /* Medium (5–7 chars) */
  medium: [
    "time","life","work","word","hand","home","room","door","book","face",
    "mind","food","love","game","code","data","name","line","tree","star",
    "head","land","rock","song","idea","king","wave","ship","fire",
    "ball","bird","fish","moon","rain","road","sign","wind","lake",
    "pool","gold","iron","snow","hill","bell","ring","path",
    "spring","autumn","copper","purple","yellow",
    "garden","window","bottle","coffee","bridge","castle","forest",
    "planet","office","school","market","basket","rabbit","ticket","pocket",
    "winner","travel","simple","double","triple","middle",
    "action","battle","carbon","dragon","engine","flower","guitar","harbor",
    "insect","jockey","kitten","ladder","marble","napkin","orange","puzzle",
    "queen","river","saddle","table","valley",
  ],
  /* Long (≥8 chars) */
  long: [
    "morning","evening","picture","village","captain","college","diamond",
    "feather","grammar","harmony","initial","justice","kitchen","leather",
    "million","natural","opinion","passage","quarter","routine","shelter",
    "thunder","weather","ambition","boundary","calendar","document","element",
    "freedom","governor","holiday","industry","junction","kingdom","library",
    "message","notebook","observe","painting","quality","railway","sandwich",
    "treasure","universe","volcano","western","example","science","history",
    "chapter","pattern","surface","machine","glimpse","problem","article",
    "present","support","country","mountain","brother","sister",
    "journey","capture","fifteen","sixteen",
    "seventy","eighty","ninety","hundred","thousand","without","because",
    "trouble","thought","through","forward","longest","vintage",
  ],
};

/* ── Morse mapping ───────────────────────────────────────────────
 *  0 = dit (·), 1 = dah (−)
 * ────────────────────────────────────────────────────────────────── */
const MORSE = {
  A:"01", B:"1000", C:"1010", D:"100", E:"0",
  F:"0010", G:"110", H:"0000", I:"00", J:"0111",
  K:"101", L:"0100", M:"11", N:"10", O:"111",
  P:"0110", Q:"1101", R:"010", S:"000", T:"1",
  U:"001", V:"0001", W:"011", X:"1001", Y:"1011",
  Z:"1100",
  0:"11111", 1:"01111", 2:"00111", 3:"00011", 4:"00001",
  5:"00000", 6:"10000", 7:"11000", 8:"11100", 9:"11110",
};

/* ── Session config ───────────────────────────────────────────── */
const WORDS_PER_SESSION = 14;

/* ── State ─────────────────────────────────────────────────────── */
const S = {
  // Session
  words:           [],        // Array of word strings
  wordIndex:       0,         // Current word index
  charIndex:       0,         // Current char index within current word
  charBuffer:      "",        // Morse buffer for current char
  started:         false,
  finished:        false,

  // Stats
  startTime:       0,
  correctChars:    0,         // Total correctly-typed characters
  streak:          0,
  maxStreak:       0,
  totalKeyStrokes: 0,         // Every dit/dah press
  mistakes:        0,         // Number of wrong attempts (buffer resets)

  // Per-character results: { wordIdx, charIdx, char, correct }
  results:         [],

  // Result lookup cache: `wordIdx-charIdx` -> result
  _resultMap:      null,
  _errorPending:   false,    // True during wrong-input reset delay

  // Audio
  audioCtx:        null,
  isKeyDown:       false,
  _timerInterval:  null,
};

/* ── Helpers ───────────────────────────────────────────────────── */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ── DOM refs ──────────────────────────────────────────────────── */
const $ = (s) => document.querySelector(s);

const DOM = {
  body:         document.body,
  wordTrack:    $("#word-track"),
  charTrack:    $("#char-track"),
  charDisplay:  $("#char-display"),
  morseChars:   $("#morse-chars"),
  cursor:       $("#cursor"),

  timerVal:     $("#timer-value"),
  cpmVal:       $("#cpm-value"),
  accuracyVal:  $("#accuracy-value"),
  streakVal:    $("#streak-value"),

  results:      $("#results"),
  resultCpm:     $("#result-cpm"),
  resultAccuracy:$("#result-accuracy"),
  resultTime:   $("#result-time"),
  resultChars:  $("#result-chars"),
  resultWords:  $("#result-words"),
  resultStreak: $("#result-streak-max"),
  resultSentence:$("#result-sentence-text"),
  restartBtn:   $("#restart-btn"),

  historyList:  $("#history-list"),
};

/* ── Audio ─────────────────────────────────────────────────────── */
function unlockAudio() {
  if (!S.audioCtx) {
    try { S.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return; }
  }
  if (S.audioCtx.state === "suspended") S.audioCtx.resume();
}

function beep(vol, freq, dur) {
  try {
    unlockAudio();
    if (!S.audioCtx) return;
    const o = S.audioCtx.createOscillator();
    const g = S.audioCtx.createGain();
    o.connect(g); g.connect(S.audioCtx.destination);
    o.frequency.value = freq;
    o.type = "square";
    g.gain.value = vol * 0.01;
    o.start(S.audioCtx.currentTime);
    o.stop(S.audioCtx.currentTime + dur * 0.001);
  } catch {}
}

function playDit() { beep(50, 650, 90); }
function playDah() { beep(50, 650, 280); }

/* ── Session generator ───────────────────────────────────────────
 *  Picks words to form a "sentence-like" sequence. Mixes lengths
 *  for natural variety.
 * ────────────────────────────────────────────────────────────────── */
function generateWords() {
  const words = [];
  // Pick a mix: ~30% short, ~50% medium, ~20% long
  for (let i = 0; i < WORDS_PER_SESSION; i++) {
    const r = Math.random();
    const pool = r < 0.3 ? WORDS.short : r < 0.8 ? WORDS.medium : WORDS.long;
    words.push(pick(pool));
  }
  return words;
}

/* ── Render word track ─────────────────────────────────────────── */
function renderWords() {
  DOM.wordTrack.innerHTML = S.words.map((w, wi) => {
    let cls = "word";
    if (wi < S.wordIndex) cls += " completed";
    else if (wi === S.wordIndex) cls += " active";
    else cls += " pending";
    return `<span class="${cls}">${w}</span>`;
  }).join("");
}

/* ── Render character track (current word's letters) ──────────── */
function renderChars() {
  if (S.wordIndex >= S.words.length) {
    DOM.charTrack.innerHTML = "";
    return;
  }

  // Build O(1) lookup map for results (lazy, only when results exist)
  if (S.results.length > 0 && !S._resultMap) {
    S._resultMap = {};
    for (const r of S.results) {
      S._resultMap[`${r.wordIdx}-${r.charIdx}`] = r;
    }
  }

  const word = S.words[S.wordIndex];
  DOM.charTrack.innerHTML = word.split("").map((ch, ci) => {
    let cls = "char-tile";
    if (ci < S.charIndex) {
      const key = `${S.wordIndex}-${ci}`;
      const res = S._resultMap ? S._resultMap[key] : null;
      cls += res && res.correct ? " completed-correct" : " completed-incorrect";
    } else if (ci === S.charIndex) {
      cls += " active";
    } else {
      cls += " pending";
    }
    return `<span class="${cls}">${ch}</span>`;
  }).join("");
}

/* ── Display helpers ───────────────────────────────────────────── */
function currentChar() {
  if (S.wordIndex >= S.words.length) return "";
  return S.words[S.wordIndex][S.charIndex] || "";
}

function updateCharDisplay() {
  DOM.charDisplay.textContent = currentChar();
}

function updateMorseOutput() {
  const visual = S.charBuffer
    .split("")
    .map(c => (c === "0" ? "·" : "−"))
    .join(" ");
  DOM.morseChars.textContent = visual || "";
}

function flashMorse(type) {
  DOM.morseChars.classList.remove("dit-flash", "dah-flash");
  void DOM.morseChars.offsetWidth;
  DOM.morseChars.classList.add(type === "dit" ? "dit-flash" : "dah-flash");
}

/* ── Stats ─────────────────────────────────────────────────────── */
function updateStats() {
  if (!S.started || S.finished) {
    if (!S.finished) {
      DOM.timerVal.textContent = "0s";
      DOM.cpmVal.textContent = "0";
    }
    DOM.accuracyVal.textContent = S.totalKeyStrokes === 0
      ? "100" : Math.round((S.correctChars / S.totalKeyStrokes) * 100);
    DOM.streakVal.textContent = S.streak;
    return;
  }

  const elapsed = (Date.now() - S.startTime) / 1000;
  const secs = Math.floor(elapsed);
  DOM.timerVal.textContent = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;

  const minutes = elapsed / 60;
  const charsDone = S.results.length;
  DOM.cpmVal.textContent = minutes > 0 ? Math.round(charsDone / minutes) : charsDone;

  DOM.accuracyVal.textContent = S.totalKeyStrokes === 0
    ? "100" : Math.round((S.correctChars / S.totalKeyStrokes) * 100);
  DOM.streakVal.textContent = S.streak;
}

function startTimer() {
  S.startTime = Date.now();
  S._timerInterval = setInterval(updateStats, 200);
}

/* ── Advance to next character ─────────────────────────────────── */
function advanceChar() {
  const ch = currentChar();
  S.results.push({ wordIdx: S.wordIndex, charIdx: S.charIndex, char: ch, correct: true });
  S.correctChars++;
  S.streak++;
  if (S.streak > S.maxStreak) S.maxStreak = S.streak;
  S.charIndex++;
  S.charBuffer = "";

  // Pop animation
  DOM.charDisplay.classList.remove("pop");
  void DOM.charDisplay.offsetWidth;
  DOM.charDisplay.classList.add("pop");

  addHistory(ch, true);

  // Check if word is complete
  if (S.charIndex >= S.words[S.wordIndex].length) {
    S.wordIndex++;
    S.charIndex = 0;
  }

  renderWords();
  renderChars();
  updateCharDisplay();
  updateMorseOutput();
  updateStats();

  if (S.wordIndex >= S.words.length) finishSession();
}

/* ── Main input handler ────────────────────────────────────────── */
function handleInput(symbol) {
  if (S.finished || S._errorPending) return;
  if (!S.started) { S.started = true; startTimer(); }

  // Play the tone for what user pressed
  if (symbol === "0") playDit(); else playDah();

  S.charBuffer += symbol;
  S.totalKeyStrokes++;
  updateMorseOutput();
  flashMorse(symbol === "0" ? "dit" : "dah");

  const ch = currentChar();
  const target = MORSE[ch.toUpperCase()];
  if (!target) return;

  // Exact match → correct!
  if (S.charBuffer === target) {
    advanceChar();
    return;
  }

  // Still building a valid prefix → keep going
  if (target.startsWith(S.charBuffer)) {
    DOM.body.classList.remove("error");
    updateStats();
    return;
  }

  // Wrong → error buzz, reset buffer after a short delay
  S.mistakes++;
  beep(40, 180, 250);
  DOM.body.classList.add("error");
  S._errorPending = true;
  setTimeout(() => {
    S.charBuffer = "";
    updateMorseOutput();
    DOM.body.classList.remove("error");
    S._errorPending = false;
  }, 350);
}

/* ── Finish session ────────────────────────────────────────────── */
function finishSession() {
  S.finished = true;
  clearInterval(S._timerInterval);
  DOM.cursor.style.visibility = "hidden";
  updateStats();
  showResults();
}

/* ── Results screen ────────────────────────────────────────────── */
function showResults() {
  const elapsed = S.startTime ? (Date.now() - S.startTime) / 1000 : 0;
  const minutes = elapsed / 60 || 0.001;
  const totalChars = S.results.length;
  // Use same accuracy metric as live view: correct chars ÷ total key strokes
  const accuracy = S.totalKeyStrokes > 0
    ? Math.round((S.correctChars / S.totalKeyStrokes) * 100) : 100;

  DOM.resultCpm.textContent     = Math.round(totalChars / minutes);
  DOM.resultAccuracy.textContent = accuracy;
  DOM.resultTime.textContent    = elapsed < 60
    ? `${Math.floor(elapsed)}s`
    : `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed) % 60}s`;
  DOM.resultChars.textContent   = totalChars;
  DOM.resultWords.textContent   = S.words.length;
  DOM.resultStreak.textContent  = S.maxStreak;

  // Show the sentence with per-word colouring
  const wordResults = S.words.map((w, wi) => {
    const wChars = S.results.filter(r => r.wordIdx === wi);
    const allCorrect = wChars.length > 0 && wChars.every(r => r.correct);
    return { word: w, allCorrect };
  });

  DOM.resultSentence.innerHTML = wordResults.map(wr =>
    `<span class="${wr.allCorrect ? "word-correct" : "word-incorrect"}">${wr.word}</span>`
  ).join(" ");

  DOM.results.classList.remove("hidden");
}

/* ── History strip ─────────────────────────────────────────────── */
function addHistory(ch) {
  const morse = (MORSE[ch.toUpperCase()] || "")
    .split("")
    .map(c => (c === "0" ? "·" : "−"))
    .join(" ");

  const chip = document.createElement("span");
  chip.className = "history-chip";
  chip.innerHTML = `<span class="chip-char">${ch}</span><span class="chip-morse">${morse}</span>`;
  DOM.historyList.prepend(chip);

  while (DOM.historyList.children.length > 20) DOM.historyList.lastChild.remove();
}

/* ── Start / restart ───────────────────────────────────────────── */
function startSession() {
  S.words = generateWords();
  S.wordIndex = 0;
  S.charIndex = 0;
  S.charBuffer = "";
  S.started = false;
  S.finished = false;
  S.startTime = 0;
  S.correctChars = 0;
  S.streak = 0;
  S.maxStreak = 0;
  S.totalKeyStrokes = 0;
  S.mistakes = 0;
  S.results = [];
  S._resultMap = null;
  S._errorPending = false;

  DOM.results.classList.add("hidden");
  DOM.body.classList.remove("error");
  DOM.historyList.innerHTML = "";

  clearInterval(S._timerInterval);
  S._timerInterval = null;

  renderWords();
  renderChars();
  updateCharDisplay();
  updateMorseOutput();
  updateStats();

  DOM.cursor.style.visibility = "visible";
  DOM.morseChars.textContent = "";
}

/* ── Input: Pointer ────────────────────────────────────────────── */
let _pointerDown = 0;

function onPointerDown() {
  if (S.finished) return;
  unlockAudio();
  _pointerDown = performance.now();
}

function onPointerUp() {
  if (S.finished) return;
  const dt = performance.now() - _pointerDown;
  handleInput(dt < 120 ? "0" : "1");
}

/* ── Input: Keyboard ───────────────────────────────────────────── */
function onKeyDown(e) {
  if (S.isKeyDown) return;

  // Restart from results
  if (S.finished) {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      startSession();
    }
    return;
  }

  unlockAudio();

  if (e.key === ".") {
    e.preventDefault();
    S.isKeyDown = true;
    handleInput("0");
  } else if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    S.isKeyDown = true;
    handleInput("1");
  }
}

function onKeyUp(e) {
  if (e.key === "." || e.key === " " || e.code === "Space") {
    S.isKeyDown = false;
  }
}

/* ── Init ───────────────────────────────────────────────────────── */
function init() {
  DOM.body.addEventListener("pointerdown", onPointerDown);
  DOM.body.addEventListener("pointerup", onPointerUp);
  DOM.body.addEventListener("touchstart", e => {
    if (e.target === DOM.body || e.target.closest("#main")) e.preventDefault();
  }, { passive: false });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  DOM.restartBtn.addEventListener("click", startSession);

  startSession();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
