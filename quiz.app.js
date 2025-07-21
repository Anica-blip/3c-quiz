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

// Helper to fetch quiz JSON from the repo (always loads quiz.01.json on Start)
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

// Normalize pages for missing type/bg
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

// Replace pageSequence if quiz is loaded after Start
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

// >>>>> NEW FUNCTION: Render blocks (title, desc, etc) dynamically <<<<<
function renderBlocks(blocks) {
  if (!blocks || !Array.isArray(blocks)) return "";
  return blocks.map(block => {
    if (block.type === "title") {
      return `<h2 class="block-title" style="color:${block.color||'#222'};font-size:${block.size||18}px;">${block.text || block.label || ''}</h2>`;
    }
    if (block.type === "desc") {
      return `<p class="block-desc">${block.text || ''}</p>`;
    }
    // Add more block types as needed!
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
      // No button on thank you page
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
    $("#nextBtn").onclick = handleStartButton; // <-- ONLY CHANGE MADE!
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

render();
