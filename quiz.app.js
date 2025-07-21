const $ = (sel) => document.querySelector(sel);
const app = $("#app");

const defaultPageSequence = [
  { type: "cover", bg: "static/1.png" },
  { type: "intro", bg: "static/2.png" },
  { type: "question", bg: "static/3a.png" },
  { type: "question", bg: "static/3b.png" },
  { type: "question", bg: "static/3c.png" },
  { type: "question", bg: "static/3d.png" },
  { type: "question", bg: "static/3e.png" },
  { type: "question", bg: "static/3f.png" },
  { type: "question", bg: "static/3g.png" },
  { type: "question", bg: "static/3h.png" },
  { type: "pre-results", bg: "static/4.png" },
  { type: "resultA", bg: "static/5a.png" },
  { type: "resultB", bg: "static/5b.png" },
  { type: "resultC", bg: "static/5c.png" },
  { type: "resultD", bg: "static/5d.png" },
  { type: "thankyou", bg: "static/6.png" },
];

let pageSequence = [...defaultPageSequence];
let NUM_QUESTIONS = 8;
let SHOW_RESULT = "A";

let state = {
  page: 0,
};

// Helper to fetch quiz JSON from quiz.01.json in the repo
async function fetchQuizConfig() {
  try {
    const res = await fetch(
      "https://anica-blip.github.io/3c-quiz/quiz-json/quiz.01.json"
    );
    if (!res.ok) throw new Error("Quiz file not found");
    const config = await res.json();
    return config;
  } catch (e) {
    console.error("Failed to load quiz JSON:", e);
    return null;
  }
}

// Compatibility layer: ensure every page has a .type
function normalizeQuizPages(config) {
  if (!config || !Array.isArray(config.pages)) return [];
  return config.pages.map((page, idx) => {
    const newPage = { ...page };
    if (!newPage.type) {
      if (idx === 0) newPage.type = "cover";
      else if (idx === 1) newPage.type = "intro";
      else if (idx === config.pages.length - 2) newPage.type = "pre-results";
      else if (idx === config.pages.length - 1) newPage.type = "thankyou";
      else newPage.type = "question";
    }
    if (!newPage.bg && config.bg) newPage.bg = config.bg;
    return newPage;
  });
}

// On Start button: always load quiz.01.json from repo
async function handleStartButton() {
  const config = await fetchQuizConfig();
  if (config && Array.isArray(config.pages) && config.pages.length > 0) {
    pageSequence = normalizeQuizPages(config);
    NUM_QUESTIONS = config.numQuestions || NUM_QUESTIONS;
    SHOW_RESULT = config.showResult || SHOW_RESULT;
    state.page = 1;
    render();
  } else {
    app.innerHTML = `<div class="fullscreen-bg" style="background-image:url('static/1.png');"></div>
    <div style="color:red;text-align:center;padding:2em;">Quiz file loaded but format is invalid.</div>`;
  }
}

function renderFullscreenBgPage({ bg, button, showBack }) {
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${bg}');"></div>
    <div class="fullscreen-bottom">
      ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      ${button ? `<button class="main-btn" id="${button.id}">${button.label}</button>` : ""}
    </div>
  `;
  if (showBack) {
    $("#backBtn").onclick = () => {
      state.page = Math.max(0, state.page - 1);
      render();
    };
  }
  if (button) {
    $(`#${button.id}`).onclick = button.onClick;
  }
}

function render() {
  app.innerHTML = "";
  const current = pageSequence[state.page];
  if (!current) {
    app.innerHTML = `<div class="fullscreen-bg" style="background-color:#111"></div>`;
    return;
  }

  let showBack = state.page > 0;
  let nextLabel = "Next";
  if (current.type === "cover") nextLabel = "Start";
  if (current.type === "pre-results") nextLabel = "Get Results";
  if (
    current.type === "resultA" ||
    current.type === "resultB" ||
    current.type === "resultC" ||
    current.type === "resultD"
  ) {
    nextLabel = "Finish";
  }

  let nextAction = () => {
    if (current.type === "pre-results") {
      if (SHOW_RESULT === "A") state.page = pageSequence.findIndex(p => p.type === "resultA");
      else if (SHOW_RESULT === "B") state.page = pageSequence.findIndex(p => p.type === "resultB");
      else if (SHOW_RESULT === "C") state.page = pageSequence.findIndex(p => p.type === "resultC");
      else if (SHOW_RESULT === "D") state.page = pageSequence.findIndex(p => p.type === "resultD");
      render();
      return;
    } else if (
      current.type === "resultA" ||
      current.type === "resultB" ||
      current.type === "resultC" ||
      current.type === "resultD"
    ) {
      state.page = pageSequence.findIndex(p => p.type === "thankyou");
      render();
      return;
    } else if (current.type === "thankyou") {
      // No button on thank you page
      return;
    }
    state.page = Math.min(state.page + 1, pageSequence.length - 1);
    render();
  };

  // COVER PAGE (card style, button inside image, NO QUIZ_CONFIG used until Start is clicked)
  if (current.type === "cover") {
    app.innerHTML = `
      <div class="cover-outer">
        <div class="cover-image-container">
          <img class="cover-img" src="${current.bg}" alt="cover"/>
          <button class
