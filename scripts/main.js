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
const WORDS_BATCH = 30;
const TIMER_OPTIONS = [30, 60, 180];

/* ── Active timer mode ───────────────────────────────────────── */
let activeTimerMode = 30;

/* ── State ─────────────────────────────────────────────────────── */
const S = {
  // Session
  words:           [],        // Array of word strings
  wordIndex:       0,         // Current word index
  charIndex:       0,         // Current char index within current word
  charBuffer:      "",        // Morse buffer for current char
  started:         false,
  finished:        false,

  // Timer
  timeLimit:       30,
  cpmHistory:      [],        // CPM sampled each second
  charsAtSecond:   [0],       // Cumulative chars at each second boundary
  elapsedSeconds:  0,

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
  muted:           false,
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
  resultChart:  $("#result-chart"),
  restartBtn:   $("#restart-btn"),
  timerBtns:    document.querySelectorAll(".timer-btn"),
  main:         $("#main"),
  inputArea:    $("#input-area"),

  historyList:  $("#history-list"),
  btnDit:       $("#btn-dit"),
  btnDah:       $("#btn-dah"),
  muteBtn:      $("#mute-btn"),
};

/* ── Audio ─────────────────────────────────────────────────────── */
function unlockAudio() {
  if (!S.audioCtx) {
    try { S.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return; }
  }
  if (S.audioCtx.state === "suspended") S.audioCtx.resume();
}

function playTone(freq, dur) {
  if (S.muted) return;
  try {
    unlockAudio();
    if (!S.audioCtx) return;
    const now = S.audioCtx.currentTime;
    const o = S.audioCtx.createOscillator();
    const g = S.audioCtx.createGain();
    o.connect(g); g.connect(S.audioCtx.destination);
    o.frequency.value = freq;
    o.type = "sine";

    // Gentle fade-in and fade-out for a natural, calm attack/release
    const fadeIn = 0.008;
    const fadeOut = 0.015;
    const totalDur = dur * 0.001;

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.35, now + fadeIn);
    g.gain.setValueAtTime(0.35, now + totalDur - fadeOut);
    g.gain.linearRampToValueAtTime(0, now + totalDur);

    o.start(now);
    o.stop(now + totalDur);
  } catch {}
}

function playDit() { playTone(660, 80); }
function playDah() { playTone(660, 260); }

/* ── Session generator ───────────────────────────────────────────
 *  Picks words to form a "sentence-like" sequence. Mixes lengths
 *  for natural variety.
 * ────────────────────────────────────────────────────────────────── */
function generateWords(count) {
  const words = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const pool = r < 0.3 ? WORDS.short : r < 0.8 ? WORDS.medium : WORDS.long;
    words.push(pick(pool));
  }
  return words;
}

function ensureWords() {
  // If fewer than 10 words remain ahead, generate another batch
  const ahead = S.words.length - S.wordIndex;
  if (ahead < 10) {
    S.words = S.words.concat(generateWords(WORDS_BATCH));
  }
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
      DOM.timerVal.textContent = `${S.timeLimit}s`;
      DOM.cpmVal.textContent = "0";
    }
    DOM.accuracyVal.textContent = S.totalKeyStrokes === 0
      ? "100" : Math.round((S.correctChars / S.totalKeyStrokes) * 100);
    DOM.streakVal.textContent = S.streak;
    return;
  }

  const elapsed = (Date.now() - S.startTime) / 1000;
  const remaining = Math.max(0, S.timeLimit - elapsed);
  const secs = Math.ceil(remaining);
  DOM.timerVal.textContent = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;

  const minutes = elapsed / 60;
  const charsDone = S.results.length;
  DOM.cpmVal.textContent = minutes > 0 ? Math.round(charsDone / minutes) : charsDone;

  DOM.accuracyVal.textContent = S.totalKeyStrokes === 0
    ? "100" : Math.round((S.correctChars / S.totalKeyStrokes) * 100);
  DOM.streakVal.textContent = S.streak;
}

function handleTimerTick() {
  const elapsed = (Date.now() - S.startTime) / 1000;
  S.elapsedSeconds = Math.floor(elapsed);

  // Record CPM at this second
  const minutes = elapsed / 60;
  const charsDone = S.results.length;
  S.charsAtSecond[S.elapsedSeconds] = charsDone;
  S.cpmHistory[S.elapsedSeconds] = minutes > 0 ? Math.round(charsDone / minutes) : charsDone;

  // Check if time's up
  if (elapsed >= S.timeLimit) {
    finishSession();
    return;
  }

  updateStats();
}

function startTimer() {
  S.startTime = Date.now();
  S.elapsedSeconds = 0;
  S.cpmHistory = [];
  S.charsAtSecond = [0];
  S._timerInterval = setInterval(handleTimerTick, 200);
}

/* ── Advance to next character ─────────────────────────────────── */
function advanceChar() {
  const ch = currentChar();
  const result = { wordIdx: S.wordIndex, charIdx: S.charIndex, char: ch, correct: true };
  S.results.push(result);
  // Keep result cache in sync so renderChars sees green immediately
  if (S._resultMap) S._resultMap[`${S.wordIndex}-${S.charIndex}`] = result;
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
    ensureWords();
  }

  renderWords();
  renderChars();
  updateCharDisplay();
  updateMorseOutput();
  updateStats();
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

  // Wrong → soft error tone, reset buffer after a short delay
  S.mistakes++;
  playTone(220, 200);
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

/* ── Chart drawing ─────────────────────────────────────────────── */
function drawChart() {
  const canvas = DOM.resultChart;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const w = rect.width;
  const h = rect.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 16, bottom: 22, left: 46, right: 16 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const history = S.cpmHistory;
  const maxSec = S.timeLimit;

  if (!history || history.length < 2) {
    ctx.fillStyle = "#333";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("not enough data", w / 2, h / 2 + 4);
    return;
  }

  const maxVal = Math.max(...history, 10);
  const yMax = Math.ceil(maxVal / 25) * 25 || 25;
  const xMax = maxSec;

  // ── helpers ──────────────────────────────────────────────
  const toX = (s) => pad.left + (s / xMax) * plotW;
  const toY = (v) => pad.top + plotH - (v / yMax) * plotH;

  // ── grid lines ───────────────────────────────────────────
  ctx.strokeStyle = "#1e1e1e";
  ctx.lineWidth = 1;
  for (let v = 0; v <= yMax; v += 25) {
    const y = toY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }
  for (let s = 0; s <= xMax; s += Math.max(1, Math.floor(xMax / 6))) {
    const x = toX(s);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, h - pad.bottom);
    ctx.stroke();
  }

  // ── axis labels ──────────────────────────────────────────
  ctx.fillStyle = "#444";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let s = 0; s <= xMax; s += Math.max(1, Math.floor(xMax / 6))) {
    ctx.fillText(`${s}s`, toX(s), h - pad.bottom + 6);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = 0; v <= yMax; v += 25) {
    ctx.fillText(String(v), pad.left - 6, toY(v));
  }

  // ── data points ──────────────────────────────────────────
  const pts = history
    .map((cpm, i) => ({ x: toX(i), y: toY(cpm), cpm }))
    .filter(p => p.cpm > 0);

  if (pts.length < 2) {
    ctx.fillStyle = "#333";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("not enough data", w / 2, h / 2 + 4);
    return;
  }

  // ── fill gradient ────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  grad.addColorStop(0, "rgba(255, 210, 0, 0.18)");
  grad.addColorStop(1, "rgba(255, 210, 0, 0.01)");

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.top + plotH);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(pts[pts.length - 1].x, pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // ── line ─────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i].x + pts[i - 1].x) / 2;
    ctx.bezierCurveTo(cx, pts[i - 1].y, cx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = "#ffd200";
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── average line ─────────────────────────────────────────
  const avgCpm = history.reduce((a, b) => a + b, 0) / history.length;
  const avgY = toY(avgCpm);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255, 210, 0, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, avgY);
  ctx.lineTo(w - pad.right, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── dots on line ─────────────────────────────────────────
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd200";
    ctx.fill();
  }
}

/* ── Results screen ────────────────────────────────────────────── */
function showResults() {
  const elapsed = S.startTime ? Math.min(Date.now() - S.startTime, S.timeLimit * 1000) / 1000 : S.timeLimit;
  const minutes = elapsed / 60 || 0.001;
  const totalChars = S.results.length;
  const accuracy = S.totalKeyStrokes > 0
    ? Math.round((S.correctChars / S.totalKeyStrokes) * 100) : 100;

  DOM.resultCpm.textContent     = Math.round(totalChars / minutes);
  DOM.resultAccuracy.textContent = accuracy;
  DOM.resultTime.textContent    = Math.floor(elapsed) < 60
    ? `${Math.floor(elapsed)}s`
    : `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed) % 60}s`;
  DOM.resultChars.textContent   = totalChars;
  DOM.resultWords.textContent   = S.wordIndex;  // words fully completed
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

  // Draw chart after a tiny delay to let the DOM settle
  requestAnimationFrame(() => requestAnimationFrame(() => drawChart()));
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

/* ── Timer button handlers ────────────────────────────────────── */
function initTimerButtons() {
  DOM.timerBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.timerBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTimerMode = parseInt(btn.dataset.time, 10);
      // Reset session with new timer mode
      if (S.finished || !S.started) startSession();
    });
  });
}

/* ── Start / restart ───────────────────────────────────────────── */
function startSession() {
  S.words = generateWords(WORDS_BATCH);
  S.wordIndex = 0;
  S.charIndex = 0;
  S.charBuffer = "";
  S.started = false;
  S.finished = false;
  S.startTime = 0;
  S.timeLimit = activeTimerMode;
  S.cpmHistory = [];
  S.charsAtSecond = [0];
  S.elapsedSeconds = 0;
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

function onPointerDown(e) {
  if (e.button !== 0 || S.finished) return;
  unlockAudio();
  _pointerDown = performance.now();
}

function onPointerUp(e) {
  if (e.button !== 0 || S.finished) return;
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
  DOM.inputArea.addEventListener("pointerdown", onPointerDown);
  DOM.inputArea.addEventListener("pointerup", onPointerUp);
  DOM.inputArea.addEventListener("touchstart", e => {
    e.preventDefault();
  }, { passive: false });
  DOM.inputArea.addEventListener("contextmenu", e => {
    e.preventDefault();
    if (S.finished) return;
    unlockAudio();
    handleInput("1");
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  DOM.restartBtn.addEventListener("click", startSession);
  initTimerButtons();

  // Mobile dit / dah buttons
  function onMorseBtn(e, symbol) {
    e.preventDefault();
    if (S.finished) return;
    unlockAudio();
    handleInput(symbol);
  }

  DOM.btnDit.addEventListener("pointerdown", e => onMorseBtn(e, "0"));
  DOM.btnDah.addEventListener("pointerdown", e => onMorseBtn(e, "1"));

  // Mute toggle
  const iconUnmuted = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.807 4.29a1 1 0 0 0-1.415 1.415 8.913 8.913 0 0 1 0 12.59 1 1 0 0 0 1.415 1.415 10.916 10.916 0 0 0 0-15.42Z" fill="currentColor"/><path d="M18.1 7.291a1 1 0 0 0-1.42 1.415 4.662 4.662 0 0 1 0 6.588 1 1 0 0 0 1.42 1.415 6.666 6.666 0 0 0 0-9.418Z" fill="currentColor"/><path d="M13.82.2A12.054 12.054 0 0 0 6.266 5H5a5.008 5.008 0 0 0-5 5v4a5.008 5.008 0 0 0 5 5h1.266a12.059 12.059 0 0 0 7.554 4.8.917.917 0 0 0 .181.017 1 1 0 0 0 1-1V1.186A1 1 0 0 0 13.82.2ZM13 21.535a10.083 10.083 0 0 1-5.371-4.08A1 1 0 0 0 6.792 17H5a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h1.8a1 1 0 0 0 .837-.453A10.079 10.079 0 0 1 13 2.465Z" fill="currentColor"/></svg>`;
  const iconMuted = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.004 20.004v2.812a1.001 1.001 0 0 1-1.181.983c-2.999-.551-5.752-2.299-7.554-4.794h-1.27a5.008 5.008 0 0 1-5.001-5.003v-4.001c0-1.116.361-2.173 1.045-3.057a1.001 1.001 0 0 1 1.582 1.224A2.966 2.966 0 0 0 1.998 10v4.001A3.006 3.006 0 0 0 5 17.003h1.78c.321 0 .622.154.811.414l.3.415a10.142 10.142 0 0 0 5.113 3.703v-1.532a1 1 0 1 1 2 0Zm8.703 3.703a.997.997 0 0 1-1.414 0l-22-22A.999.999 0 1 1 1.707.293L6.33 4.916C8.131 2.468 10.855.753 13.822.205a1 1 0 0 1 1.181.984v12.402l1.686 1.686a4.717 4.717 0 0 0 1.31-3.276 4.718 4.718 0 0 0-1.392-3.359.999.999 0 1 1 1.414-1.414 6.707 6.707 0 0 1 1.978 4.773 6.706 6.706 0 0 1-1.896 4.69l1.415 1.415c3.33-3.418 3.304-8.908-.081-12.292A.999.999 0 1 1 20.851 4.4c4.164 4.164 4.191 10.922.081 15.12l2.774 2.774a.999.999 0 0 1 0 1.414ZM7.762 6.348l5.242 5.242V2.468A10.14 10.14 0 0 0 7.89 6.17l-.128.178Z" fill="currentColor"/></svg>`;

  DOM.muteBtn.addEventListener("click", () => {
    S.muted = !S.muted;
    const icon = DOM.muteBtn.querySelector("svg");
    icon.outerHTML = S.muted ? iconMuted : iconUnmuted;
    DOM.muteBtn.title = S.muted ? "Unmute sounds" : "Mute sounds";
  });

  startSession();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
