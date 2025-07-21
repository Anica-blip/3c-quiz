const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// --- Helper: get quizUrl from ?quizUrl=... ---
function getQuizUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("quizUrl");
}

// --- Helper: Fetch JSON from the quizUrl ---
async function fetchQuizConfig(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Quiz file not found");
    return await res.json();
  } catch (e) {
    console.error("Failed to load quiz JSON:", e);
    return null;
  }
}

// --- Default page sequence (for fallback) ---
const defaultPageSequence = [
  { type: "cover", bg: "static/1.png", blocks: [] },
  { type: "intro", bg: "static/2.png", blocks: [] },
  { type: "question", bg: "static/3a.png", blocks: [] },
  { type: "question", bg: "static/3b.png", blocks: [] },
  { type: "question", bg: "static/3c.png", blocks: [] },
  { type: "question", bg: "static/3d.png", blocks: [] },
  { type: "question", bg: "static/3e.png", blocks: [] },
  { type: "question", bg: "static/3f.png", blocks: [] },
  { type: "question", bg: "static/3g.png", blocks: [] },
  { type: "question", bg: "static/3h.png", blocks: [] },
  { type: "pre-results", bg: "static/4.png", blocks: [] },
  { type: "resultA", bg: "static/5a.png", blocks: [] },
  { type: "resultB", bg: "static/5b.png", blocks: [] },
  { type: "resultC", bg: "static/5c.png", blocks: [] },
  { type: "resultD", bg: "static/5d.png", blocks: [] },
  { type: "thankyou", bg: "static/6.png", blocks: [] },
];

// --- App State ---
let pageSequence = [...defaultPageSequence];
let NUM_QUESTIONS = 8;
let SHOW_RESULT = "A";
let quizConfig = null;

let state = {
  page: 0,
};

// --- Load quiz if quizUrl exists ---
(async () => {
  const quizUrl = getQuizUrl();
  if (quizUrl) {
    const config = await fetchQuizConfig(quizUrl);
    if (config && Array.isArray(config.pages)) {
      quizConfig = config;
      pageSequence = config.pages;
      NUM_QUESTIONS = config.numQuestions || NUM_QUESTIONS;
      SHOW_RESULT = config.showResult || SHOW_RESULT;
    }
  }
  render();
})();

// --- Render a single block (text etc) from JSON ---
function renderBlock(block) {
  // Basic block: text positioned absolutely
  // You can expand this to handle more types (images, buttons, etc.)
  const {
    type = "text",
    label = "",
    text = "",
    x = 0, y = 0, w = 200, h = 50,
    size = 18,
    color = "#222",
    align = "left", // you can add more block properties!
  } = block;

  // Convert block properties to CSS
  return `
    <div class="quiz-block" style="
      position: absolute;
      left: ${x}px; top: ${y}px;
      width: ${w}px; height: ${h}px;
      font-size: ${size}px;
      color: ${color};
      text-align: ${align};
      overflow: hidden;
      white-space: pre-line;
      pointer-events: none;
    ">
      ${text}
    </div>
  `;
}

// --- Main renderer ---
function render() {
  app.innerHTML = "";
  const current = pageSequence[state.page];
  if (!current) {
    // Show blank bg if no page
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
      return;
    }
    state.page = Math.min(state.page + 1, pageSequence.length - 1);
    render();
  };

  // --- RENDER PAGE WITH BLOCKS ---
  // Use the page's bg image, and render all blocks absolutely
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
    <div class="quiz-blocks-container" style="position:relative; width:100vw; height:100vh;">
      ${Array.isArray(current.blocks) ? current.blocks.map(renderBlock).join("") : ""}
    </div>
    <div class="fullscreen-bottom">
      ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      ${current.type !== "thankyou" ? `<button class="main-btn" id="nextBtn">${nextLabel}</button>` : ""}
    </div>
  `;

  if (current.type !== "thankyou") {
    $("#nextBtn").onclick = nextAction;
  }
  if (showBack) {
    $("#backBtn").onclick = () => {
      if (
        current.type === "thankyou" ||
        current.type === "resultA" ||
        current.type === "resultB" ||
        current.type === "resultC" ||
        current.type === "resultD"
      ) {
        state.page = pageSequence.findIndex(p => p.type === "pre-results");
      } else if (current.type === "pre-results") {
        state.page = pageSequence.findIndex((p, i) => p.type === "question" && i > 0 && i < pageSequence.length) + NUM_QUESTIONS - 1;
      } else {
        state.page = Math.max(state.page - 1, 0);
      }
      render();
    };
  }
}

// You may want to add CSS for .quiz-block in your style.css for more control!
