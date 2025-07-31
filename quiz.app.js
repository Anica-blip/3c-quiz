const $ = (sel) => document.querySelector(sel);
const app = $("#app");

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

function renderErrorScreen(extra = "") {
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-color:#111"></div>
    <div class="page-content">
      <div class="content-inner">
        <h2>Error: No page data</h2>
        <p>The quiz could not be loaded or is empty or the page is malformed. Please check your quiz data.</p>
        ${extra}
        <div class="fullscreen-bottom">
          <button class="main-btn" onclick="window.location.reload()">Reload</button>
        </div>
      </div>
    </div>
  `;
}

// --- GENIUS BLOCK RENDERING: scale block coordinates if needed ---
function renderBlocks(blocks, scale) {
  if (!Array.isArray(blocks)) return "";
  let html = "";
  blocks.forEach(block => {
    let type = (block.type || "").trim().toLowerCase();
    let style = "";

    // All coordinates and sizes get scaled if scale != 1
    const sx = scale, sy = scale;
    if (
      type === "title" ||
      type === "description" ||
      type === "desc" ||
      type === "question" ||
      type === "answer" ||
      type === "result"
    ) {
      if (block.width !== undefined) style += `width:${block.width * sx}px;`;
      if (block.height !== undefined) style += `height:${block.height * sy}px;`;
      if (block.x !== undefined) style += `left:${block.x * sx}px;`;
      if (block.y !== undefined) style += `top:${block.y * sy}px;`;
      style += `position:absolute;`;
      if (block.fontSize) style += `font-size:${typeof block.fontSize === "number" ? block.fontSize * sx + "px" : block.fontSize};`;
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
    renderErrorScreen(`<div style="color:#f00"><strong>${state.quizError}</strong></div>`);
    return;
  }

  // --- GENIUS: always same logic for block/image overlay ---
  if (["intro", "question", "pre-results", "resultA", "resultB", "resultC", "resultD", "thankyou"].includes(current.type)) {
    // SCALE = container width / design width (375)
    const vw = Math.min(window.innerWidth, 450);
    const scale = vw < 375 ? vw / 375 : 1;
    const containerW = 375 * scale;
    const containerH = 600 * scale;

    app.innerHTML = `
      <div class="fullscreen-centered" style="width:100vw;height:100vh;display:flex;justify-content:center;align-items:flex-start;">
        <div class="quiz-image-overlay" style="position:relative;width:${containerW}px;height:${containerH}px;">
          <img class="quiz-bg-img" src="${current.bg}" alt="Quiz background" draggable="false"
            style="width:${containerW}px;height:${containerH}px;display:block;"/>
          <div class="block-layer" style="position:absolute;left:0;top:0;width:${containerW}px;height:${containerH}px;pointer-events:none;">
            ${renderBlocks(current.blocks, scale)}
          </div>
        </div>
      </div>
      <div class="fullscreen-bottom">
        ${state.page > 0 ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
        ${current.type !== "thankyou" ? `<button class="main-btn" id="nextBtn">${current.type === "pre-results" ? "Get Results" : current.type.startsWith("result") ? "Finish" : "Next"}</button>` : ""}
      </div>
    `;
    if (current.type !== "thankyou") $("#nextBtn").onclick = () => {
      if (current.type === "pre-results") {
        if (SHOW_RESULT === "A") state.page = pageSequence.findIndex(p => p.type === "resultA");
        else if (SHOW_RESULT === "B") state.page = pageSequence.findIndex(p => p.type === "resultB");
        else if (SHOW_RESULT === "C") state.page = pageSequence.findIndex(p => p.type === "resultC");
        else if (SHOW_RESULT === "D") state.page = pageSequence.findIndex(p => p.type === "resultD");
        render();
        return;
      } else if (current.type.startsWith("result")) {
        state.page = pageSequence.findIndex(p => p.type === "thankyou");
        render();
        return;
      } else if (current.type === "thankyou") {
        return;
      }
      state.page = Math.min(state.page + 1, pageSequence.length - 1);
      render();
    };
    if (state.page > 0) {
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
          <button class="main-btn cover-btn-in-img" id="startBtn">Start</button>
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
