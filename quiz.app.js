const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// Editor grid reference for all block coordinates (update if your admin/editor changed)
const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 600;

// --- Loader logic unchanged ---
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

// --- Store user answers for result calculation ---
let userAnswers = []; // Will hold "A", "B", "C", "D" for each question

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
    <div style="background-color:#111;min-height:100vh;width:100vw;"></div>
    <div style="position:fixed;top:20vh;left:10vw;width:80vw;z-index:10;color:#fff;">
      <h2>Error: No page data</h2>
      <p>The quiz could not be loaded or is empty or the page is malformed. Please check your quiz data.</p>
      ${extra}
      <div style="margin-top:2em;">
        <button class="main-btn" onclick="window.location.reload()">Reload</button>
      </div>
    </div>
  `;
}

// --- Block rendering logic: fits overlay to the ACTUAL displayed image ONLY, per page ---
// --- Fine-tune Text Block sizes according to page background image ---
// --- Center block horizontally, and set width for wrapping, per your instructions ---
function renderBlocks(blocks, scaleX, scaleY, shrinkFactor = 0.97) {
  if (!Array.isArray(blocks)) return "";
  let html = "";
  const currentBg = pageSequence[state.page]?.bg || "";

  // Determine correct block width for this page
  // 2.png, 5a.png, 5b.png, 5c.png, 5d.png, 6.png -> width 275
  // 3a.png-3h.png, 4.png -> width 294
  let blockWidthDesign = 294;
  if (
    [
      "static/2.png",
      "static/5a.png",
      "static/5b.png",
      "static/5c.png",
      "static/5d.png",
      "static/6.png"
    ].includes(currentBg)
  ) {
    blockWidthDesign = 275;
  }

  // Only affect main text blocks
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
      // Calculate scaled block width
      const img = $("#quiz-bg-img");
      const imgW = img ? img.getBoundingClientRect().width : DESIGN_WIDTH;
      const widthPx = blockWidthDesign * scaleX * shrinkFactor;
      const leftPx = (imgW - widthPx) / 2;

      style += `left: ${leftPx.toFixed(2)}px;`;
      if (block.y !== undefined) style += `top: ${(block.y * scaleY * shrinkFactor).toFixed(2)}px;`;
      style += `width: ${widthPx.toFixed(2)}px;`;
      if (block.height !== undefined) style += `height: ${(block.height * scaleY * shrinkFactor).toFixed(2)}px;`;

      style += "position:absolute;box-sizing:border-box;overflow:hidden;";
      style += "display:block;";
      style += "white-space:pre-line;word-break:break-word;overflow-wrap:break-word;";

      if (block.fontSize) style += `font-size: ${(typeof block.fontSize === "string" ? parseFloat(block.fontSize) : block.fontSize) * scaleY * shrinkFactor}px;`;
      if (block.color) style += `color:${block.color};`;
      if (block.fontWeight) style += `font-weight:${block.fontWeight};`;
      if (block.textAlign) style += `text-align:${block.textAlign};`;
      if (block.margin !== undefined) style += `margin:${block.margin};`;
      if (block.lineHeight) style += `line-height:${block.lineHeight};`;

      let className = "";
      if (type === "title") className = "block-title";
      else if (type === "description" || type === "desc") className = "block-desc";
      else if (type === "question") className = "block-question";
      else if (type === "answer") className = "block-answer";
      else if (type === "result") className = "block-result";

      html += `<div class="${className}" style="${style}">${block.text}</div>`;
    }
  });
  return html;
}

// Helper: get all question pages index
function getQuestionPageIndexes() {
  return pageSequence
    .map((page, idx) => (page.type === "question" ? idx : -1))
    .filter(idx => idx >= 0);
}

// Helper: calculate result type from answers
function calculateResultType(answers) {
  // Count each answer
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  answers.forEach(ans => {
    if (counts.hasOwnProperty(ans)) counts[ans]++;
  });
  // Find which answer has the highest count
  // If tie, show first in order: A, B, C, D
  let max = 0;
  let resultType = "A";
  for (let type of ["A", "B", "C", "D"]) {
    if (counts[type] > max) {
      max = counts[type];
      resultType = type;
    }
  }
  return resultType;
}

function render() {
  app.innerHTML = "";
  const current = pageSequence[state.page];

  if (state.quizError) {
    renderErrorScreen(`<div style="color:#f00"><strong>${state.quizError}</strong></div>`);
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
      // Calculate results from userAnswers!
      const resultType = calculateResultType(userAnswers);
      SHOW_RESULT = resultType;
      // Jump to correct result page
      let nextResultPage = pageSequence.findIndex(p => p.type === "result" + resultType);
      if (nextResultPage === -1) nextResultPage = pageSequence.findIndex(p => p.type === "resultA");
      state.page = nextResultPage;
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
    // Normal next
    state.page = Math.min(state.page + 1, pageSequence.length - 1);
    render();
  };

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
            userAnswers = []; // Reset answers
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
        userAnswers = [];
        render();
      }
    };
    return;
  }

  // MAIN QUIZ PAGES: render as image+block overlay, fitted to image display and never overflowing
  if (
    ["intro", "question", "pre-results", "resultA", "resultB", "resultC", "resultD", "thankyou"].includes(current.type)
  ) {
    app.innerHTML = `
      <div id="quiz-img-wrap" style="display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:auto;">
        <div id="img-block-container" style="position:relative;overflow:visible;">
          <img id="quiz-bg-img" src="${current.bg}" alt="quiz background" style="display:block;width:auto;height:auto;max-width:96vw;max-height:90vh;" />
          <div id="block-overlay-layer" style="position:absolute;left:0;top:0;pointer-events:none;"></div>
        </div>
      </div>
      <div class="fullscreen-bottom">
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
        ${current.type !== "thankyou" ? `<button class="main-btn" id="nextBtn">${nextLabel}</button>` : ""}
      </div>
    `;
    const img = $("#quiz-bg-img");
    img.onload = () => {
      // 1. Measure image's actual displayed width and height
      const rect = img.getBoundingClientRect();
      const displayW = rect.width;
      const displayH = rect.height;

      // 2. Align the overlay container to the image's true position and size
      const overlay = $("#block-overlay-layer");
      overlay.style.width = displayW + "px";
      overlay.style.height = displayH + "px";
      overlay.style.left = "0px";
      overlay.style.top = "0px";

      // 3. For each block, use the PER-IMAGE scale factor and a shrink factor to guarantee no overflow
      const scaleX = displayW / DESIGN_WIDTH;
      const scaleY = displayH / DESIGN_HEIGHT;

      overlay.innerHTML = renderBlocks(current.blocks, scaleX, scaleY, 0.97);

      // --- If this is a question page, add answer buttons below the image ---
      if (current.type === "question") {
        // Render answer buttons (A/B/C/D)
        const btnWrapper = document.createElement("div");
        btnWrapper.className = "answer-btn-row";
        btnWrapper.style = "display:flex;justify-content:center;gap:12px;margin-top:20px;";
        ["A", "B", "C", "D"].forEach((ansType, idx) => {
          const btn = document.createElement("button");
          btn.className = "main-btn";
          btn.textContent = "ANSWER " + ansType;
          btn.onclick = () => {
            userAnswers[state.page - 2] = ansType; // Store answer by question index (assuming intro at 1, questions start at 2)
            // Go to next question or pre-results
            const questionPages = getQuestionPageIndexes();
            const currentQIdx = questionPages.indexOf(state.page);
            if (currentQIdx < questionPages.length - 1) {
              state.page = questionPages[currentQIdx + 1];
            } else {
              // Go to pre-results
              state.page = pageSequence.findIndex(p => p.type === "pre-results");
            }
            render();
          };
          btnWrapper.appendChild(btn);
        });
        // Insert buttons after image-block
        $("#img-block-container").appendChild(btnWrapper);
      }
    };
    if (img.complete) img.onload();

    if (current.type !== "thankyou") $("#nextBtn").onclick = nextAction;
    if (showBack) {
      $("#backBtn").onclick = () => {
        // For back navigation, restore previous answer page, or pre-results, etc.
        if (
          current.type === "thankyou" ||
          current.type === "resultA" ||
          current.type === "resultB" ||
          current.type === "resultC" ||
          current.type === "resultD"
        ) {
          state.page = pageSequence.findIndex(p => p.type === "pre-results");
        } else if (current.type === "pre-results") {
          // Go to last question page
          const questionPages = getQuestionPageIndexes();
          state.page = questionPages[questionPages.length - 1];
        } else {
          state.page = Math.max(state.page - 1, 0);
        }
        render();
      };
    }
    return;
  }
}

render();
window.addEventListener("resize", render);
