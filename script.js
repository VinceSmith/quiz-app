// Simple multi-subject quiz (vanilla JS, no bundler)
// Loads subjects from quizzes/subjects.json -> [{slug,name,file}]
// Each subject file: { items: [{ level, question, choices, answerIndex, explanation }] }

const els = {
  screenMenu: document.getElementById('screen-menu'),
  screenQuiz: document.getElementById('screen-quiz'),
  screenResults: document.getElementById('screen-results'),
  subjectSelect: document.getElementById('subjectSelect'),
  countSelect: document.getElementById('countSelect'),
  startBtn: document.getElementById('startBtn'),
  difficultyChips: document.getElementById('difficultyChips'),
  crumbs: document.getElementById('crumbs'),
  scoreNow: document.getElementById('scoreNow'),
  progressBar: document.getElementById('progressBar'),
  questionStem: document.getElementById('questionStem'),
  choices: document.getElementById('choices'),
  feedback: document.getElementById('feedback'),
  submitBtn: document.getElementById('submitBtn'),
  nextBtn: document.getElementById('nextBtn'),
  quitBtn: document.getElementById('quitBtn'),
  finalScore: document.getElementById('finalScore'),
  retryBtn: document.getElementById('retryBtn'),
  menuBtn: document.getElementById('menuBtn'),
  reviewList: document.getElementById('reviewList'),
};

const state = {
  subjects: [],
  selectedSubjectSlug: null,
  selectedDifficulty: 'Beginner',
  count: 10,
  deck: [],
  index: 0,
  selection: null,
  submitted: false,
  correctCount: 0,
  history: [],
  sourceItems: [],
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function showScreen(name) {
  els.screenMenu.classList.toggle('hidden', name !== 'menu');
  els.screenQuiz.classList.toggle('hidden', name !== 'quiz');
  els.screenResults.classList.toggle('hidden', name !== 'results');
}

// Manifest
async function loadManifest() {
  const res = await fetch('quizzes/subjects.json');
  const data = await res.json();
  state.subjects = data.subjects || [];
  els.subjectSelect.innerHTML = '';
  state.subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.slug;
    opt.textContent = s.name;
    els.subjectSelect.appendChild(opt);
  });
  state.selectedSubjectSlug = state.subjects[0]?.slug || null;
}

// Load one subject
async function loadSubject(slug) {
  const entry = state.subjects.find(s => s.slug === slug);
  if (!entry) throw new Error('Unknown subject: ' + slug);
  const res = await fetch(entry.file);
  const json = await res.json();
  const items = Array.isArray(json) ? json : (json.items || []);
  state.sourceItems = items;
  return items;
}

// Build deck
function buildDeck() {
  const pool = state.sourceItems.filter(q => q.level === state.selectedDifficulty);
  if (pool.length === 0) return [];
  const n = clamp(state.count, 1, pool.length);
  const deck = shuffle(pool).slice(0, n).map(q => {
    const correct = q.choices[q.answerIndex];
    const choices = shuffle(q.choices);
    const correctIdx = choices.indexOf(correct);
    return { ...q, choices, correctIdx };
  });
  return deck;
}

// Render question
function render() {
  const total = state.deck.length;
  const i = state.index;
  els.crumbs.textContent = `${state.selectedSubjectSlug} • ${state.selectedDifficulty} • Question ${i + 1} of ${total}`;
  els.scoreNow.textContent = `Score: ${state.correctCount}`;
  const pct = total ? Math.round((i / total) * 100) : 0;
  els.progressBar.style.width = pct + '%';

  const q = state.deck[i];
  els.questionStem.textContent = q.question;

  els.choices.innerHTML = '';
  q.choices.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = label;
    btn.onclick = () => {
      if (state.submitted) return;
      state.selection = idx;
      [...els.choices.children].forEach(c => c.classList.remove('pick'));
      btn.classList.add('pick');
    };
    els.choices.appendChild(btn);
  });

  els.feedback.classList.add('hidden');
  els.feedback.classList.remove('ok', 'bad');
  els.submitBtn.disabled = false;
  els.nextBtn.disabled = true;
}

// Submit
function submit() {
  if (state.selection == null || state.submitted) return;
  const q = state.deck[state.index];
  const picked = state.selection;
  const correctIdx = q.correctIdx;
  const isCorrect = picked === correctIdx;
  state.submitted = true;
  if (isCorrect) state.correctCount++;

  [...els.choices.children].forEach((node, idx) => {
    if (idx === correctIdx) node.classList.add('correct');
    if (idx === picked && idx !== correctIdx) node.classList.add('incorrect', 'pick');
  });

  els.feedback.textContent = (isCorrect ? 'Correct ✔️ ' : 'Not quite ❌ ') + ' ' + (q.explanation || '');
  els.feedback.classList.remove('hidden');
  els.feedback.classList.add(isCorrect ? 'ok' : 'bad');

  els.submitBtn.disabled = true;
  els.nextBtn.disabled = false;

  state.history.push({ q, pickedIdx: picked, correctIdx, isCorrect });
}

// Next
function next() {
  if (!state.submitted) return;
  const last = state.index + 1 >= state.deck.length;
  if (last) {
    showResults();
  } else {
    state.index += 1;
    state.selection = null;
    state.submitted = false;
    render();
  }
}

// Results
function showResults() {
  showScreen('results');
  const pct = Math.round((state.correctCount / state.deck.length) * 100);
  els.finalScore.textContent = `Score: ${state.correctCount} / ${state.deck.length} (${pct}%)`;

  els.reviewList.innerHTML = '';
  state.history.forEach((h, idx) => {
    const div = document.createElement('div');
    div.className = 'item';
    const meta = document.createElement('div');
    meta.className = 'meta subtle';
    meta.textContent = `Q${idx + 1} • ${h.isCorrect ? '✔️' : '❌'}`;
    const stem = document.createElement('div');
    stem.textContent = h.q.question;
    const your = document.createElement('div');
    const correct = document.createElement('div');
    your.innerHTML = `<strong>Your answer:</strong> ${h.q.choices[h.pickedIdx] ?? '—'}`;
    correct.innerHTML = `<strong>Correct:</strong> ${h.q.choices[h.correctIdx]}`;
    const exp = document.createElement('div');
    exp.className = 'subtle';
    exp.textContent = 'Explanation: ' + (h.q.explanation || '');
    div.appendChild(meta); div.appendChild(stem); div.appendChild(your); div.appendChild(correct); div.appendChild(exp);
    els.reviewList.appendChild(div);
  });
}

// Start / Quit / Retry
async function start() {
  state.selectedSubjectSlug = els.subjectSelect.value;
  state.count = parseInt(els.countSelect.value, 10);
  const pickedChip = els.difficultyChips.querySelector('.chip.selected');
  state.selectedDifficulty = pickedChip?.dataset.level || 'Beginner';

  await loadSubject(state.selectedSubjectSlug);
  state.deck = buildDeck();
  if (state.deck.length === 0) {
    alert('No questions available for that difficulty. Try another level.');
    return;
  }
  state.index = 0; state.selection = null; state.submitted = false; state.correctCount = 0; state.history = [];
  showScreen('quiz');
  render();
}
function quitToMenu() {
  const ok = confirm('Quit and return to the main menu? Your progress will be lost.');
  if (!ok) return;
  showScreen('menu');
}
function retrySameSettings() {
  state.deck = buildDeck();
  if (state.deck.length === 0) {
    alert('No questions available for that difficulty.');
    showScreen('menu');
    return;
  }
  state.index = 0; state.selection = null; state.submitted = false; state.correctCount = 0; state.history = [];
  showScreen('quiz');
  render();
}

// Wire UI
els.difficultyChips.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  els.difficultyChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
});
els.subjectSelect.addEventListener('change', (e) => {
  state.selectedSubjectSlug = e.target.value;
});
els.startBtn.addEventListener('click', start);
els.submitBtn.addEventListener('click', submit);
els.nextBtn.addEventListener('click', next);
els.quitBtn.addEventListener('click', quitToMenu);
els.retryBtn.addEventListener('click', retrySameSettings);
els.menuBtn.addEventListener('click', () => showScreen('menu'));

// init
loadManifest();
