// Simple multi-subject quiz (vanilla JS, no bundler)
// Loads subjects from quizzes/subjects.json -> [{slug,name,file}]
// Subject files now support:
// - items: MCQ [{ level, question, choices, answerIndex, explanation }]
// - anki:  [{ level, front, back, explanation? }]
// - cloze: [{ level, prompt?, cloze }], where cloze text uses {{answer}} blanks

const els = {
  screenMenu: document.getElementById('screen-menu'),
  screenQuiz: document.getElementById('screen-quiz'),
  screenResults: document.getElementById('screen-results'),
  subjectSelect: document.getElementById('subjectSelect'),
  writeupField: document.getElementById('writeupField'),
  subjectWriteup: document.getElementById('subjectWriteup'),
  countSelect: document.getElementById('countSelect'),
  startBtn: document.getElementById('startBtn'),
  difficultyChips: document.getElementById('difficultyChips'),
  modeTabs: document.getElementById('modeTabs'),
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
  mode: 'mcq', // 'mcq' | 'anki' | 'cloze'
  selectedDifficulty: 'Mix',
  count: 'all',
  deck: [],
  index: 0,
  selection: null,
  submitted: false,
  correctCount: 0,
  history: [],
  sourceItems: [], // MCQ
  sourceAnki: [],  // Anki
  sourceCloze: [], // Cloze
  writeupMarkdown: '',
  // When true, difficulty selection UI should be disabled (e.g., subject uses level: 'None')
  levelsDisabled: false,
  // breakdown counts
  tally: {
    Beginner: { right: 0, wrong: 0 },
    Intermediate: { right: 0, wrong: 0 },
    Advanced: { right: 0, wrong: 0 },
  },
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
  state.subjects = (data.subjects || []).slice();
  // Sort subjects alphabetically by name, but ensure Token Protection stays first if present
  state.subjects.sort((a, b) => a.name.localeCompare(b.name));
  const tpIdx = state.subjects.findIndex(s => s.slug === 'token-protection' || s.name === 'TLS, DPoP, and mTLS');
  if (tpIdx > 0) {
    const [tp] = state.subjects.splice(tpIdx, 1);
    state.subjects.unshift(tp);
  }
  const defaultSlug = state.subjects.find(s => s.slug === 'token-protection' || s.name === 'TLS, DPoP, and mTLS')?.slug || state.subjects[0]?.slug || null;
  els.subjectSelect.innerHTML = '';
  state.subjects.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.slug;
    opt.textContent = s.name;
    if (s.slug === defaultSlug) opt.selected = true;
    els.subjectSelect.appendChild(opt);
  });
  // Set default to Token Protection if available; otherwise, first item
  state.selectedSubjectSlug = defaultSlug;
}

// Load one subject
async function loadSubject(slug) {
  const entry = state.subjects.find(s => s.slug === slug);
  if (!entry) throw new Error('Unknown subject: ' + slug);
  const res = await fetch(entry.file);
  const json = await res.json();
  const items = Array.isArray(json) ? json : (json.items || []);
  const anki = Array.isArray(json?.anki) ? json.anki : [];
  const cloze = Array.isArray(json?.cloze) ? json.cloze : [];
  state.sourceItems = items;
  state.sourceAnki = anki;
  state.sourceCloze = cloze;
  // write-up: support either `writeup`, `paper_markdown`, or `paper` fields
  state.writeupMarkdown = (json.writeup || json.paper_markdown || json.paper || '').toString();
  renderWriteup();
  // Disable difficulty selector if every card uses level: 'None'
  const combined = [].concat(items || [], anki || [], cloze || []).filter(Boolean);
  state.levelsDisabled = combined.length > 0 && combined.every(c => String(c.level || '').toLowerCase() === 'none');
  updateDifficultyUI();
}

// Minimal Markdown -> HTML (headings, emphasis, code ticks, lists, paragraphs)
function mdToHtml(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // code ticks
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // headings
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
             .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
             .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
             .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
             .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
             .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  // bold/italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // unordered lists (line-wise to avoid runaway bullets)
  const lines = html.split('\n');
  const out = [];
  let listBuf = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push('<ul>');
      listBuf.forEach(item => out.push('<li>' + item + '</li>'));
      out.push('</ul>');
      listBuf = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*[-•]\s+(.*)$/);
    if (m) {
      listBuf.push(m[1]);
    } else {
      flushList();
      out.push(line);
    }
  }
  flushList();
  html = out.join('\n');
  // paragraphs (split on blank lines)
  html = html.split(/\n\s*\n/).map(block => {
    if (/^<h[1-6]>|^<ul>|^<pre>|^<blockquote>/.test(block)) return block;
    return '<p>' + block.replace(/\n/g, '<br/>') + '</p>';
  }).join('\n');
  return html;
}

function renderWriteup() {
  const has = !!state.writeupMarkdown && state.writeupMarkdown.trim().length > 0;
  if (!els.writeupField) return;
  els.writeupField.classList.toggle('hidden', !has);
  if (!has) {
    if (els.subjectWriteup) els.subjectWriteup.innerHTML = '';
    // If no writeup, still ensure difficulty UI reflects content
    updateDifficultyUI();
    return;
  }
  if (els.subjectWriteup) {
    els.subjectWriteup.innerHTML = mdToHtml(state.writeupMarkdown);
  }
}

// Update the difficulty selector UI based on state.levelsDisabled
function updateDifficultyUI() {
  if (!els.difficultyChips) return;
  const chips = els.difficultyChips.querySelectorAll('.chip');
  chips.forEach(ch => {
    ch.disabled = !!state.levelsDisabled;
    ch.classList.toggle('disabled', !!state.levelsDisabled);
  });
  if (state.levelsDisabled) {
    // Force Mix selection when disabled
    state.selectedDifficulty = 'Mix';
    chips.forEach(c => c.classList.toggle('selected', c.dataset.level === 'Mix'));
  }
}

// Toggle Overview tab visibility based on write-up availability
function updateOverviewTabVisibility() {
  const overviewTab = document.querySelector('#modeTabs .tab[data-mode="overview"]');
  const hasWriteup = !!(state.writeupMarkdown && state.writeupMarkdown.trim().length > 0);
  if (overviewTab) {
    overviewTab.classList.toggle('hidden', !hasWriteup);
  }
  // If no writeup and overview is currently selected, switch to MCQ
  const selectedTab = document.querySelector('#modeTabs .tab.selected');
  const isOverviewSelected = selectedTab?.dataset.mode === 'overview';
  if (!hasWriteup && isOverviewSelected) {
    handleModeSwitch('mcq');
  }
}

// Build deck for selected mode/difficulty
function buildDeck() {
  let pool = [];
  const pickFrom = (arr) => state.selectedDifficulty === 'Mix'
    ? arr.slice()
    : arr.filter(q => q.level === state.selectedDifficulty);
  if (state.mode === 'mcq') {
    pool = pickFrom(state.sourceItems);
  } else if (state.mode === 'anki') {
    pool = pickFrom(state.sourceAnki);
  } else if (state.mode === 'cloze') {
    pool = pickFrom(state.sourceCloze);
  }
  if (pool.length === 0) return [];
  const allPicked = /^(all)$/i.test(els.countSelect.value || String(state.count));
  const n = allPicked ? pool.length : clamp(parseInt(els.countSelect.value || String(state.count), 10) || pool.length, 1, pool.length);
  const picked = shuffle(pool).slice(0, n);

  if (state.mode === 'mcq') {
    return picked.map(q => {
      const choices = shuffle(q.choices);
      let correctIdx;
      if (Array.isArray(q.answerIndex)) {
        correctIdx = q.answerIndex.map(idx => choices.indexOf(q.choices[idx]));
      } else {
        const correct = q.choices[q.answerIndex];
        correctIdx = choices.indexOf(correct);
      }
    return { ...q, choices, correctIdx };
    });
  }
  // anki / cloze pass through
  return picked.map(card => ({ ...card }));
}

// Dispatch render
function render() {
  const total = state.deck.length;
  const i = state.index;
  const cur = state.deck[i];
  // Show only Subject name and question counter in header
  const subjName = (state.subjects.find(s => s.slug === state.selectedSubjectSlug)?.name) || state.selectedSubjectSlug || '';
  els.crumbs.textContent = `${subjName} • Question ${i + 1} of ${total}`;
  els.scoreNow.textContent = `Score: ${state.correctCount}`;
  const pct = total ? Math.round((i / total) * 100) : 0;
  els.progressBar.style.width = pct + '%';

  els.feedback.classList.add('hidden');
  els.feedback.classList.remove('ok', 'bad');
  els.choices.innerHTML = '';
  const meta = document.getElementById('questionMeta');
  if (meta) meta.innerHTML = '';

  // Blank state if no items for this mode/difficulty
  if (total === 0) {
    renderBlank();
    return;
  }

  // Difficulty badge inside question area
  const lvlBadge = state.selectedDifficulty === 'Mix' ? (cur?.level || '') : state.selectedDifficulty;
  if (document.getElementById('questionMeta') && lvlBadge) {
    document.getElementById('questionMeta').innerHTML = `<span class="badge">${lvlBadge}</span>`;
  }

  if (state.mode === 'mcq') renderMCQ();
  else if (state.mode === 'anki') renderAnki();
  else if (state.mode === 'cloze') renderCloze();
}

function submit() {
  if (state.mode === 'mcq') return submitMCQ();
  if (state.mode === 'anki') return submitAnki();
  if (state.mode === 'cloze') return submitCloze();
}

// MCQ MODE
function renderMCQ() {
  const q = state.deck[state.index];
  els.questionStem.textContent = q.question;
  state.selection = Array.isArray(q.correctIdx) ? [] : null;
  q.choices.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = label;
    btn.onclick = () => {
      if (state.submitted) return;
      if (Array.isArray(q.correctIdx)) {
        if (!state.selection.includes(idx)) {
          state.selection.push(idx);
          btn.classList.add('pick');
        } else {
          state.selection = state.selection.filter(i => i !== idx);
          btn.classList.remove('pick');
        }
      } else {
        state.selection = idx;
        [...els.choices.children].forEach(c => c.classList.remove('pick'));
        btn.classList.add('pick');
      }
    };
    els.choices.appendChild(btn);
  });
  els.submitBtn.textContent = 'Submit';
  els.submitBtn.disabled = false;
  els.nextBtn.textContent = 'Next';
  els.nextBtn.disabled = true;
}

function submitMCQ() {
  if ((state.selection == null || (Array.isArray(state.selection) && state.selection.length === 0)) || state.submitted) return;
  const q = state.deck[state.index];
  const picked = state.selection;
  const correctIdx = q.correctIdx;
  let isCorrect;
  if (Array.isArray(correctIdx)) {
    isCorrect = Array.isArray(picked) && picked.length === correctIdx.length && picked.every(idx => correctIdx.includes(idx)) && correctIdx.every(idx => picked.includes(idx));
  } else {
    isCorrect = picked === correctIdx;
  }
  state.submitted = true;
  if (isCorrect) state.correctCount++;
  // Tally by difficulty
  const lvl = q.level || 'Beginner';
  if (isCorrect) state.tally[lvl].right++; else state.tally[lvl].wrong++;

  [...els.choices.children].forEach((node, idx) => {
    if (Array.isArray(correctIdx)) {
      if (correctIdx.includes(idx)) node.classList.add('correct');
      if (picked.includes(idx) && !correctIdx.includes(idx)) node.classList.add('incorrect', 'pick');
    } else {
      if (idx === correctIdx) node.classList.add('correct');
      if (idx === picked && idx !== correctIdx) node.classList.add('incorrect', 'pick');
    }
  });

  els.feedback.textContent = (isCorrect ? 'Correct ✅ ' : 'Not quite ❌ ') + ' ' + (q.explanation || '');
  els.feedback.classList.remove('hidden');
  els.feedback.classList.add(isCorrect ? 'ok' : 'bad');

  els.submitBtn.disabled = true;
  els.nextBtn.disabled = false;

  state.history.push({ mode: 'mcq', q, pickedIdx: picked, correctIdx, isCorrect });
}

// ANKI MODE
function renderAnki() {
  const card = state.deck[state.index];
  els.questionStem.textContent = card.front || card.question || '';

  // Input area for user's guess
  const inputWrap = document.createElement('div');
  inputWrap.className = 'field';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'ankiInput';
  input.placeholder = 'Type your answer…';
  input.autocomplete = 'off';
  inputWrap.appendChild(input);
  els.choices.appendChild(inputWrap);

  // Side-by-side reveal area (hidden initially)
  const grid = document.createElement('div');
  grid.id = 'ankiGrid';
  grid.className = 'anki-grid';
  grid.style.display = 'none';

  const yourCol = document.createElement('div');
  yourCol.className = 'anki-col';
  const yourLabel = document.createElement('div');
  yourLabel.className = 'subtle';
  yourLabel.textContent = 'Your answer';
  const yourVal = document.createElement('div');
  yourVal.id = 'ankiYourVal';
  yourCol.appendChild(yourLabel);
  yourCol.appendChild(yourVal);

  const correctCol = document.createElement('div');
  correctCol.className = 'anki-col';
  const correctLabel = document.createElement('div');
  correctLabel.className = 'subtle';
  correctLabel.textContent = 'Correct';
  const back = document.createElement('div');
  back.id = 'ankiBack';
  back.textContent = (card.back || '').toString();
  correctCol.appendChild(correctLabel);
  correctCol.appendChild(back);

  grid.appendChild(yourCol);
  grid.appendChild(correctCol);
  els.choices.appendChild(grid);

  els.feedback.textContent = card.explanation || '';
  els.feedback.classList.add('hidden');

  els.submitBtn.textContent = 'Show Answer';
  els.submitBtn.disabled = false;
  els.nextBtn.textContent = 'Next';
  els.nextBtn.disabled = true;
}

function submitAnki() {
  if (state.submitted) return;
  const input = document.getElementById('ankiInput');
  const yourVal = document.getElementById('ankiYourVal');
  const grid = document.getElementById('ankiGrid');
  const back = document.getElementById('ankiBack');
  const userAnswer = (input?.value || '').toString();
  if (yourVal) yourVal.textContent = userAnswer || '—';
  if (input) input.disabled = true;
  if (grid) grid.style.display = '';
  state.submitted = true;
  // Correctness check (case/whitespace-insensitive)
  const card = state.deck[state.index];
  const norm = (s) => s.toString().trim().replace(/\s+/g, ' ').toLowerCase();
  const isCorrect = norm(userAnswer) === norm(card.back || '');
  if (isCorrect) {
    state.correctCount++;
    if (yourVal) yourVal.style.color = 'var(--ok)';
    els.feedback.textContent = 'Correct ✅';
    els.feedback.classList.remove('hidden');
    els.feedback.classList.add('ok');
    els.feedback.classList.remove('bad');
  } else {
    if (yourVal) yourVal.style.color = 'var(--bad)';
    els.feedback.textContent = 'Not quite ❌';
    els.feedback.classList.remove('hidden');
    els.feedback.classList.add('bad');
    els.feedback.classList.remove('ok');
  }
  els.submitBtn.disabled = true;
  els.nextBtn.disabled = false;
  // Tally by difficulty
  const lvl = card.level || 'Beginner';
  if (isCorrect) state.tally[lvl].right++; else state.tally[lvl].wrong++;
  state.history.push({ mode: 'anki', isCorrect, level: lvl, front: card.front || '', back: card.back || '', your: userAnswer, explanation: card.explanation || '' });
}

// CLOZE MODE
function parseCloze(text) {
  const frag = document.createDocumentFragment();
  const answers = [];
  const regex = /\{\{(.*?)\}\}/g;
  let lastIndex = 0;
  let m;
  let idx = 0;
  while ((m = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
    if (before) frag.appendChild(document.createTextNode(before));
    const ans = m[1].trim();
    answers.push(ans);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cloze-blank';
    input.dataset.blankIndex = String(idx++);
    input.size = Math.min(Math.max(ans.length, 4), 24);
    frag.appendChild(input);
    lastIndex = m.index + m[0].length;
  }
  const rest = text.slice(lastIndex);
  if (rest) frag.appendChild(document.createTextNode(rest));
  return { frag, answers };
}

function renderCloze() {
  const card = state.deck[state.index];
  const text = card.cloze || card.text || '';
  els.questionStem.textContent = card.prompt || 'Fill in the blanks:';
  const { frag, answers } = parseCloze(text);
  const holder = document.createElement('div');
  holder.className = 'cloze-holder';
  holder.appendChild(frag);
  els.choices.appendChild(holder);
  state.selection = new Array(answers.length).fill('');
  state._clozeAnswers = answers;

  els.submitBtn.textContent = 'Submit';
  els.submitBtn.disabled = false;
  els.nextBtn.textContent = 'Next';
  els.nextBtn.disabled = true;
}

function submitCloze() {
  if (state.submitted) return;
  const inputs = els.choices.querySelectorAll('input.cloze-blank');
  const picked = [];
  inputs.forEach(inp => picked.push(inp.value.trim()));
  const correct = state._clozeAnswers || [];
  const isCorrect = picked.length === correct.length && picked.every((v, i) => v.toLowerCase() === (correct[i] || '').toLowerCase());
  state.submitted = true;
  if (isCorrect) state.correctCount++;
  // Tally by difficulty
  const lvl = (state.deck[state.index].level) || 'Beginner';
  if (isCorrect) state.tally[lvl].right++; else state.tally[lvl].wrong++;
  inputs.forEach((inp, i) => {
    const ok = inp.value.trim().toLowerCase() === (correct[i] || '').toLowerCase();
    inp.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)';
    if (!ok) inp.title = `Correct: ${correct[i]}`;
  });
  els.feedback.textContent = isCorrect ? 'Correct ✅' : `Not quite ❌  Correct: ${correct.join(', ')}`;
  els.feedback.classList.remove('hidden');
  els.feedback.classList.add(isCorrect ? 'ok' : 'bad');
  els.submitBtn.disabled = true;
  els.nextBtn.disabled = false;
  const card = state.deck[state.index];
  state.history.push({ mode: 'cloze', level: lvl, prompt: card.prompt || '', cloze: card.cloze || card.text || '', picked, correct, isCorrect });
}

function renderBlank() {
  // Show a clean, empty state with disabled controls
  els.questionStem.textContent = '';
  els.choices.innerHTML = '';
  els.feedback.classList.add('hidden');
  els.feedback.classList.remove('ok', 'bad');
  els.submitBtn.disabled = true;
  els.nextBtn.disabled = true;
}

// Next
function next() {
  if (!state.submitted) return;
  els.feedback.textContent = '';
  els.feedback.classList.add('hidden');
  els.feedback.classList.remove('ok', 'bad');
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
  const pct = Math.round((state.correctCount / (state.deck.length || 1)) * 100);
  els.finalScore.textContent = `Score: ${state.correctCount} / ${state.deck.length} (${pct}%)`;

  // Difficulty breakdown
  const b = state.tally;
  const breakdown = document.getElementById('difficultyBreakdown');
  if (breakdown) {
    breakdown.innerHTML = '';
    ['Beginner','Intermediate','Advanced'].forEach(level => {
      const total = b[level].right + b[level].wrong;
      if (!total) return;
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `<div class="meta"><strong>${level}</strong><span>${b[level].right} right • ${b[level].wrong} wrong</span></div>`;
      breakdown.appendChild(item);
    });
  }

  els.reviewList.innerHTML = '';
  state.history.forEach((h, idx) => {
    const div = document.createElement('div');
    div.className = 'item';
    const meta = document.createElement('div');
    meta.className = 'meta subtle';
    if (h.mode === 'mcq') {
  meta.textContent = `Q${idx + 1} • ${(h.q.level || '')} • ${h.isCorrect ? '✅' : '❌'}`;
      const stem = document.createElement('div');
      stem.textContent = h.q.question;
      const your = document.createElement('div');
      const correct = document.createElement('div');
      if (Array.isArray(h.correctIdx)) {
        your.innerHTML = `<strong>Your answer:</strong> ${h.pickedIdx.map(i => h.q.choices[i]).join(', ') || '—'}`;
        correct.innerHTML = `<strong>Correct:</strong> ${h.correctIdx.map(i => h.q.choices[i]).join(', ')}`;
      } else {
        your.innerHTML = `<strong>Your answer:</strong> ${h.q.choices[h.pickedIdx] ?? '—'}`;
        correct.innerHTML = `<strong>Correct:</strong> ${h.q.choices[h.correctIdx]}`;
      }
      const exp = document.createElement('div');
      exp.className = 'subtle';
      exp.textContent = 'Explanation: ' + (h.q.explanation || '');
      div.appendChild(meta); div.appendChild(stem); div.appendChild(your); div.appendChild(correct); div.appendChild(exp);
    } else if (h.mode === 'anki') {
  meta.textContent = `Card ${idx + 1} • ${(h.level || '')} • ${h.isCorrect ? '✅' : '❌'}`;
      const front = document.createElement('div');
      front.innerHTML = `<strong>Front:</strong> ${h.front}`;
  const your = document.createElement('div');
  your.innerHTML = `<strong>Your answer:</strong> ${h.your ?? ''}`;
      const back = document.createElement('div');
      back.innerHTML = `<strong>Back:</strong> ${h.back}`;
      const exp = document.createElement('div');
      exp.className = 'subtle';
      exp.textContent = h.explanation ? 'Note: ' + h.explanation : '';
  div.appendChild(meta); div.appendChild(front); div.appendChild(your); div.appendChild(back); if (h.explanation) div.appendChild(exp);
    } else if (h.mode === 'cloze') {
  meta.textContent = `Q${idx + 1} • ${(h.level || '')} • ${h.isCorrect ? '✅' : '❌'}`;
      const prompt = document.createElement('div');
      prompt.textContent = h.prompt || 'Fill in the blanks:';
      const your = document.createElement('div');
      your.innerHTML = `<strong>Your answers:</strong> ${h.picked.join(', ') || '—'}`;
      const correct = document.createElement('div');
      correct.innerHTML = `<strong>Correct:</strong> ${h.correct.join(', ')}`;
      div.appendChild(meta); div.appendChild(prompt); div.appendChild(your); div.appendChild(correct);
    }
    els.reviewList.appendChild(div);
  });
}

// Start / Quit / Retry
async function start() {
  state.selectedSubjectSlug = els.subjectSelect.value;
  const pickedChip = els.difficultyChips.querySelector('.chip.selected');
  state.selectedDifficulty = pickedChip?.dataset.level || 'Mix';

  await loadSubject(state.selectedSubjectSlug);
  state.deck = buildDeck();
  // For Anki/Cloze: allow blank state; for MCQ, alert as before
  if (state.deck.length === 0 && state.mode === 'mcq') {
    alert('No content available for that difficulty. Try another level.');
    return;
  }
  state.index = 0;
  state.selection = null;
  state.submitted = false;
  state.correctCount = 0;
  state.history = [];
  state.tally = { Beginner: { right: 0, wrong: 0 }, Intermediate: { right: 0, wrong: 0 }, Advanced: { right: 0, wrong: 0 } };
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
  if (state.deck.length === 0 && state.mode === 'mcq') {
    alert('No content available for that difficulty.');
    showScreen('menu');
    return;
  }
  state.index = 0;
  state.selection = null;
  state.submitted = false;
  state.correctCount = 0;
  state.history = [];
  showScreen('quiz');
  render();
}

// Wire UI
els.difficultyChips.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn || btn.disabled) return;
  els.difficultyChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
});
els.subjectSelect.addEventListener('change', (e) => {
  state.selectedSubjectSlug = e.target.value;
  // Load the subject to update write-up preview (non-blocking for quiz start)
  loadSubject(state.selectedSubjectSlug)
    .then(() => {
      updateOverviewTabVisibility();
      const hasWriteup = !!(state.writeupMarkdown && state.writeupMarkdown.trim().length > 0);
      handleModeSwitch(hasWriteup ? 'overview' : 'mcq');
    })
    .catch(() => {
      state.writeupMarkdown = '';
      renderWriteup();
      updateOverviewTabVisibility();
      handleModeSwitch('mcq');
    });
});
els.startBtn.addEventListener('click', start);
els.submitBtn.addEventListener('click', submit);
els.nextBtn.addEventListener('click', next);
// Finish Now: end quiz early and show results for answered questions
els.finishBtn = document.getElementById('finishBtn');
els.finishBtn.addEventListener('click', () => {
  // Trim deck/history to answered questions only
  const answered = state.history.length;
  if (answered === 0) {
    showScreen('results');
    els.finalScore.textContent = 'No questions answered.';
    return;
  }
  state.deck = state.deck.slice(0, answered);
  showResults();
});
els.quitBtn.addEventListener('click', quitToMenu);
els.retryBtn.addEventListener('click', retrySameSettings);
els.menuBtn.addEventListener('click', () => showScreen('menu'));

// Mode tab interactions
function handleModeSwitch(newMode) {
  // Update tab selection UI
  const tabToSelect = document.querySelector(`#modeTabs .tab[data-mode="${newMode}"]`);
  if (tabToSelect) {
    els.modeTabs.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('selected');
      t.setAttribute('aria-selected', 'false');
    });
    tabToSelect.classList.add('selected');
    tabToSelect.setAttribute('aria-selected', 'true');
  }
  if (newMode === 'overview') {
    document.getElementById('overviewPane')?.classList.remove('hidden');
    document.getElementById('quizOptionsPane')?.classList.add('hidden');
    return;
  }
  state.mode = newMode; // mcq | anki | cloze
  document.getElementById('overviewPane')?.classList.add('hidden');
  document.getElementById('quizOptionsPane')?.classList.remove('hidden');
  const label = state.mode === 'anki' ? 'Start Anki' : state.mode === 'cloze' ? 'Start Cloze' : 'Start Quiz';
  els.startBtn.textContent = label;
}

els.modeTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const newMode = tab.dataset.mode;
  handleModeSwitch(newMode);
});

// init
loadManifest().then(() => {
  if (state.selectedSubjectSlug) {
    loadSubject(state.selectedSubjectSlug)
      .then(() => updateOverviewTabVisibility())
      .catch(() => {});
  }
  // Default to Overview tab visible, quiz options hidden until a quiz tab is chosen
  document.getElementById('overviewPane')?.classList.remove('hidden');
  document.getElementById('quizOptionsPane')?.classList.add('hidden');
});
