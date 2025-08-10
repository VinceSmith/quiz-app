let currentQuestionIndex = 0;
let score = 0;
let questions = [];

const subjectSelect = document.getElementById('subject');
const startBtn = document.getElementById('start-btn');
const quizContainer = document.getElementById('quiz-container');
const mainMenu = document.getElementById('main-menu');
const resultScreen = document.getElementById('result');
const questionEl = document.getElementById('question');
const answersEl = document.getElementById('answers');
const nextBtn = document.getElementById('next-btn');
const quitBtn = document.getElementById('quit-btn');
const scoreEl = document.getElementById('score');
const restartBtn = document.getElementById('restart-btn');

async function loadSubjects() {
    const files = ['python', 'javascript', 'html'];
    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file.charAt(0).toUpperCase() + file.slice(1);
        subjectSelect.appendChild(option);
    });
}

async function loadQuestions(subject) {
    const res = await fetch(`quizzes/${subject}.json`);
    questions = await res.json();
}

function showQuestion() {
    let current = questions[currentQuestionIndex];
    questionEl.textContent = current.question;
    answersEl.innerHTML = '';

    current.answers.forEach(answer => {
        const btn = document.createElement('button');
        btn.textContent = answer.text;
        btn.onclick = () => {
            if (answer.correct) score++;
            nextBtn.disabled = false;
        };
        answersEl.appendChild(btn);
    });

    nextBtn.disabled = true;
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        showResult();
    }
}

function showResult() {
    quizContainer.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    scoreEl.textContent = `You scored ${score} out of ${questions.length}`;
}

startBtn.onclick = async () => {
    await loadQuestions(subjectSelect.value);
    currentQuestionIndex = 0;
    score = 0;
    mainMenu.classList.add('hidden');
    quizContainer.classList.remove('hidden');
    showQuestion();
};

nextBtn.onclick = nextQuestion;

quitBtn.onclick = () => {
    quizContainer.classList.add('hidden');
    mainMenu.classList.remove('hidden');
};

restartBtn.onclick = () => {
    resultScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
};

loadSubjects();
