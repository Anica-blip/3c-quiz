const $ = (sel) => document.querySelector(sel);
const app = $("#app");

const defaultPageSequence = [
  { type: "cover", bg: "static/1.png", blocks: [{type:"title", text:"Default Cover Page"}] },
  { type: "intro", bg: "static/2.png", blocks: [{type:"desc", text:"Default Intro Page"}] },
  { type: "question", bg: "static/3a.png", blocks: [{type:"desc", text:"Default Q1"}] },
  { type: "thankyou", bg: "static/6.png", blocks: [{type:"desc", text:"Thank you!"}] },
];

let pageSequence = [...defaultPageSequence];
let NUM_QUESTIONS = 8;
let SHOW_RESULT = "A";

let state = {
  page: 0,
};

// Fetch quiz JSON from live URL
async function fetchQuizConfig() {
  try {
    const url = "https://anica-blip.github.io/3c-quiz/quiz-json/quiz.01.json";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Quiz file not found");
    const config = await res.json();
    return config;
  } catch (e) {
    console.error("Failed to load quiz JSON:", e);
    return null;
  }
}

// Normalize structure and blocks
function normalizeQuizPages(config) {
  if (!config || !Array.isArray(config.pages) || config.pages.length === 0) return [...defaultPageSequence];
  return config.pages.map((page, idx) => {
    const newPage = { ...page };
    if (!newPage.type) {
      if (idx === 0) newPage.type = "cover";
      else if (idx === 1) newPage.type = "intro";
      else if (idx === config.pages.length - 2) newPage.type = "pre-results";
      else if (idx === config.pages.length - 1) newPage.type = "thankyou";
      else newPage.type = "question";
    }
    if (!newPage.bg) newPage.bg = defaultPageSequence[idx] ? defaultPageSequence[idx].bg : "static/1.png";
    if (!Array.isArray(newPage.blocks)) newPage.blocks = [];
    return newPage;
  });
}

// Fetch and start quiz
async function handleStartButton() {
  const config = await fetchQuizConfig();
  if (config) {
    pageSequence = normalizeQuizPages(config);
    NUM_QUESTIONS = config.numQuestions || NUM_QUESTIONS;
    SHOW_RESULT = config.showResult || SHOW_RESULT;
  }
  state.page = 1;
  render();
}

// RENDER BLOCKS FROM JSON WITH FULL STYLING SUPPORT
function renderBlocks(blocks) {
  if (!blocks || !Array.isArray(blocks)) return "";
  return blocks.map(block => {
    // Style properties for absolute/relative content
    let style = "";
    if (typeof block.x === "number") style += `left:${block.x}px;`;
    if (typeof block.y === "number") style += `top:${block.y}px;`;
    if (typeof block.w === "number") style += `width:${block.w}px;`;
    if (typeof block.h === "number") style += `height:${block.h}px;`;
    if (block.color) style += `color:${block.color};`;
    if (block.size) style += `font-size:${block.size}px;`;
    if (block.align) style += `text-align:${block.align};`;
    if (block.maxlen) style += `max-width:${block.maxlen}px;word-break:break-word;`;

    // Use absolute positioning if x/y are present
    let posClass = (typeof block.x === "number" || typeof block.y === "number") ? "block-abs" : "";

    if (block.type === "title") {
      return `<div class="block block-title ${posClass}" style="${style}">${block.text || block.label || ""}</div>`;
    }
    if (block.type === "desc") {
      return `<div class="block block-desc ${posClass}" style="${style}">${block.text || ""}</div>`;
    }
    // Add more block types as you add them to your JSON
    return "";
  }).join("");
}

// Helper to render full screen background pages
function renderFullscreenBgPage({ bg, button, showBack, blocks }) {
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${bg}');"></div>
    <div class="fullscreen-blocks">
      ${renderBlocks(blocks)}
    </div>
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
      return;
    }
    state.page = Math.min(state.page + 1, pageSequence.length - 1);
    render();
  };

  // COVER PAGE
  if (current.type === "cover") {
    app.innerHTML = `
      <div class="cover-outer">
        <div class="cover-image-container">
          <img class="cover-img" src="${current.bg}" alt="cover"/>
          <div class="cover-blocks">
            ${renderBlocks(current.blocks)}
          </div>
          <button class="main-btn cover-btn-in-img" id="nextBtn">${nextLabel}</button>
        </div>
      </div>
    `;
    $("#nextBtn").onclick = handleStartButton;
    return;
  }

  // INTRO PAGE
  if (current.type === "intro") {
    renderFullscreenBgPage({
      bg: current.bg,
      button: { label: "Continue", id: "mainBtn", onClick: () => {
        state.page++;
        render();
      }},
      showBack: true,
      blocks: current.blocks
    });
    return;
  }

  // THANK YOU PAGE
  if (current.type === "thankyou") {
    app.innerHTML = `
      <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
      <div class="page-content">
        <div class="content-inner">
          ${renderBlocks(current.blocks)}
        </div>
      </div>
      <div class="fullscreen-bottom">
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      </div>
    `;
    if (showBack) {
      $("#backBtn").onclick = () => {
        state.page = pageSequence.findIndex(p => p.type === "pre-results");
        render();
      };
    }
    return;
  }

  // ALL OTHER PAGES (question, result, pre-results, etc)
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
    <div class="page-content">
      <div class="content-inner">
        ${renderBlocks(current.blocks)}
      </div>
    </div>
    <div class="fullscreen-bottom">
      ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      <button class="main-btn" id="nextBtn">${nextLabel}</button>
    </div>
  `;

  $("#nextBtn").onclick = nextAction;
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

// Add this to your CSS file:
/*
.block-abs { position: absolute; }
.block-title { font-weight: bold; }
.block-desc { }
*/

render();
