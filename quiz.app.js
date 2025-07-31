const $ = (sel) => document.querySelector(sel);
const app = $("#app");

const DESIGN_WIDTH = 375;   // Editor's intended image width
const DESIGN_HEIGHT = 600;  // Editor's intended image height

// --- GitHub Pages Loader ---
async function fetchQuizFromRepoByQuizUrl(quizUrl) {
  const repoBase = window.location.origin + "/3c-quiz/quizzes/";
  const url = `${repoBase}${quizUrl}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Quiz file not found at: ${url}`);
    const data = await response.json();

    let pages = data.pages;
    if (typeof pages === "string") pages = JSON.parse(pages);
    else if (!Array.isArray(pages) && typeof pages === "object" && pages !== null) pages = Object.values(pages);

    let numQuestions = 0;
    if (Array.isArray(pages)) {
      numQuestions = pages.filter(p => {
        if (p.type === "question") return true;
        if (Array.isArray(p.blocks)) return p.blocks.some(b => b.type === "question");
        return false;
      }).length;
    }

    return {
      pages,
      numQuestions,
      showResult: data.showResult || "A",
    };
  } catch (err) {
    return { error: err.message || "Unknown error during quiz fetch." };
  }
}

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
  quizLoaded: false,
  quizError: ""
};

function getQuizUrlParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("quizUrl");
}

function autoFixPages(pages) {
  return pages.map((p, idx) => {
    if (typeof p.type === "string" && p.type.length > 0) return p;
    if (
      (Array.isArray(p.answers) && p.answers.length > 0) ||
      (Array.isArray(p.blocks) && p.blocks.some(b => b.type === "answer"))
    ) {
      return { ...p, type: "question" };
    }
    if (idx === 0) return { ...p, type: "cover" };
    if (idx === pages.length - 1) return { ...p, type: "thankyou" };
    if (p.bg && p.bg.includes("4")) return { ...p, type: "pre-results" };
    if (p.bg && p.bg.includes("5a")) return { ...p, type: "resultA" };
    if (p.bg && p.bg.includes("5b")) return { ...p, type: "resultB" };
    if (p.bg && p.bg.includes("5c")) return { ...p, type: "resultC" };
    if (p.bg && p.bg.includes("5d")) return { ...p, type: "resultD" };
    return { ...p, type: "intro" };
  });
}

// --- GENIUS BLOCK RENDERING: scale block coordinates to fit the bg image ---
function renderBlocks(blocks, scale) {
  if (!Array.isArray(blocks)) return "";
  let html = "";

  blocks.forEach(block => {
    let type = (block.type || "").trim().toLowerCase();
    let style = "";
    if (
      type === "title" ||
      type === "description" ||
      type === "desc" ||
      type === "question" ||
      type === "answer" ||
      type === "result"
    ) {
      if (block.width !== undefined) style += `width:${block.width * scale}px;`;
      if (block.height !== undefined) style += `height:${block.height * scale}px;`;
      if (block.x !== undefined) style += `left:${block.x * scale}px;`;
      if (block.y !== undefined) style += `top:${block.y * scale}px;`;
      style += `position:absolute;`;
      if (block.fontSize) style += `font-size:${(typeof block.fontSize === "string" ? parseFloat(block.fontSize) : block.fontSize) * scale}px;`;
      if (block.color) style += `color:${block.color};`;
      if (block.fontWeight) style += `font-weight:${block.fontWeight};`;
      if (block.textAlign) style += `text-align:${block.textAlign};`;
      if (block.margin !== undefined) style += `margin:${block.margin};`;
      if (block.lineHeight) style += `line-height:${block.lineHeight};`;

      if (type === "title") {
        html += `<div class="block-title" style="${style}">${block.text}</div>`;
      } else if (type === "description" || type === "desc") {
        html += `<div class="block-desc" style="${style}">${block.text}</div>`;
      } else if (type === "question") {
        html += `<div class="block-question" style="${style}">${block.text}</div>`;
      } else if (type === "answer") {
        html += `<div class="block-answer" style="${style}" data-answer="${block.value || block.text}">${block.text}</div>`;
      } else if (type === "result") {
        html += `<div class="block-result" style="${style}">${block.text}</div>`;
      }
    }
  });
  return html;
}

function render() {
  app.innerHTML = "";
  const current = pageSequence[state.page];

  if (state.quizError) {
    app.innerHTML = `<div style="color:red;padding:2em;">${state.quizError}</div>`;
    return;
  }

  if (!current || typeof current.type !== "string") {
    app.innerHTML = `<div style="color:red;">Invalid page data.</div>`;
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

  // --- FIX: use <img> and overlay block-layer absolutely on top ---
  if (["intro", "question", "pre-results", "resultA", "resultB", "resultC", "resultD", "thankyou"].includes(current.type)) {
    // Calculate scale to fit screen (keep aspect ratio)
    const maxW = Math.min(window.innerWidth, 500);
    const maxH = Math.min(window.innerHeight, 900);
    const scale = Math.min(maxW / DESIGN_WIDTH, maxH / DESIGN_HEIGHT, 1);

    const imgW = DESIGN_WIDTH * scale;
    const imgH = DESIGN_HEIGHT * scale;

    app.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;">
        <div style="position:relative;width:${imgW}px;height:${imgH}px;">
          <img src="${current.bg}" alt="bg" style="width:${imgW}px;height:${imgH}px;display:block;"/>
          <div style="position:absolute;left:0;top:0;width:${imgW}px;height:${imgH}px;pointer-events:none;">
            ${renderBlocks(current.blocks, scale)}
          </div>
        </div>
      </div>
      <div class="fullscreen-bottom">
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
        ${current.type !== "thankyou" ? `<button class="main-btn" id="nextBtn">${nextLabel}</button>` : ""}
      </div>
    `;
    if (current.type !== "thankyou") $("#nextBtn").onclick = nextAction;
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
    return;
  }

  if (current.type === "cover") {
    app.innerHTML = `
      <div class="cover-outer">
        <div class="cover-image-container">
          <img class="cover-img" src="${current.bg}" alt="cover"/>
          <button class="main-btn cover-btn-in-img" id="startBtn">${nextLabel}</button>
        </div>
      </div>
    `;
    $("#startBtn").onclick = async () => {
      $("#startBtn").disabled = true;
      const quizUrlParam = getQuizUrlParam();
      if (quizUrlParam) {
        try {
          const config = await fetchQuizFromRepoByQuizUrl(quizUrlParam);

          if (config && config.error) {
            state.quizError = config.error;
            render();
            return;
          }
          if (config && Array.isArray(config.pages) && config.pages.length > 0) {
            config.pages = autoFixPages(config.pages);
            pageSequence = config.pages;
            NUM_QUESTIONS = config.numQuestions;
            SHOW_RESULT = config.showResult || SHOW_RESULT;
            state.page = 1;
            state.quizLoaded = true;
            state.quizError = "";
            render();
          } else {
            state.quizError = "No quiz data loaded from repository!";
            render();
          }
        } catch (err) {
          state.quizError = err.message || "Error loading quiz from repository.";
          render();
        }
      } else {
        state.page = 1;
        state.quizLoaded = true;
        state.quizError = "";
        render();
      }
    };
    return;
  }
}

// --- Start by showing the cover page ---
render();
window.addEventListener("resize", () => render());
