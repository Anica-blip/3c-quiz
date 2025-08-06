const $ = (sel) => document.querySelector(sel);

let app;
function ensureApp() {
  app = $("#app");
  if (!app) {
    document.addEventListener("DOMContentLoaded", () => {
      app = $("#app");
      render();
    });
    return false;
  }
  return true;
}

const DESIGN_WIDTH = 350; // Updated to match image context
const DESIGN_HEIGHT = 600;

// --- Loader logic ---
let quizConfig = null;

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

    let questionPages = [];
    if (Array.isArray(pages)) {
      questionPages = pages.map((p, idx) => {
        if (p.type === "question" && Array.isArray(p.blocks)) {
          let answers = p.blocks
            .filter(b => b.type === "answer")
            .map(b => {
              if (typeof b.resultType === "string" && b.resultType.length === 1) return b.resultType.trim().toUpperCase();
              let match = /^([A-D])\./.exec(b.text.trim());
              if (match) return match[1];
              let firstLetter = b.text.trim().charAt(0).toUpperCase();
              if (['A', 'B', 'C', 'D'].includes(firstLetter)) return firstLetter;
              return '';
            });
          return { idx, answers };
        }
        return null;
      }).filter(p => p !== null);
    }

    let numQuestions = questionPages.length;
    let userAnswers = [];

    function setAnswer(questionIndex, answerValue) {
      if (['A','B','C','D'].includes(answerValue)) {
        userAnswers[questionIndex] = answerValue;
      }
    }

    function getNextQuestionPageIndex(currentIndex) {
      let questionIdxs = questionPages.map(q => q.idx);
      let currentQ = questionIdxs.indexOf(currentIndex);
      if (currentQ < questionIdxs.length - 1) {
        return questionIdxs[currentQ + 1];
      } else {
        return pages.findIndex(p => p.type === "pre-results");
      }
    }

    function calculateResultType() {
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      userAnswers.forEach(ans => {
        if (typeof ans === "string") {
          const val = ans.trim().toUpperCase();
          if (counts.hasOwnProperty(val)) counts[val]++;
        }
      });
      let max = Math.max(counts.A, counts.B, counts.C, counts.D);
      let maxTypes = [];
      for (let type of ["A", "B", "C", "D"]) {
        if (counts[type] === max && max > 0) {
          maxTypes.push(type);
        }
      }
      for (let type of ["A", "B", "C", "D"]) {
        if (maxTypes.includes(type)) return type;
      }
      return "A";
    }

    function getResultPageIndex() {
      const resultType = calculateResultType();
      let resultPageType = "result" + resultType;
      let pageIdx = pages.findIndex(p => p.type === resultPageType);
      if (pageIdx === -1) pageIdx = pages.findIndex(p => p.type === "resultA");
      return pageIdx;
    }

    function getThankYouPageIndex() {
      return pages.findIndex(p => p.type === "thankyou");
    }

    function debugQuizAnswerLogic() {
      return {
        questionPages,
        userAnswers,
        resultType: calculateResultType(),
        resultPageIndex: getResultPageIndex()
      };
    }

    return {
      pages,
      numQuestions,
      showResult: data.showResult || "A",
      userAnswers,
      setAnswer,
      getNextQuestionPageIndex,
      calculateResultType,
      getResultPageIndex,
      getThankYouPageIndex,
      debugQuizAnswerLogic,
      questionPages
    };
  } catch (err) {
    return { error: err.message || "Unknown error during quiz fetch." };
  }
}

// --- Everything below is the original app loader logic (UNTOUCHED) ---
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
  if (!ensureApp()) return;
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

// --- FIXED SECTION: Render answer blocks as colored transparent buttons with proper coordinates ---
function getAnswerColor(letter) {
  switch (letter) {
    case "A": return "rgba(52, 152, 219, 0.35)"; // blue
    case "B": return "rgba(46, 204, 113, 0.35)"; // green
    case "C": return "rgba(231, 76, 60, 0.35)"; // red
    case "D": return "rgba(241, 196, 15, 0.35)"; // yellow
    default: return "rgba(255,255,255,0.2)";
  }
}

function getAnswerBorderColor(letter) {
  switch (letter) {
    case "A": return "#3498db";
    case "B": return "#27ae60";
    case "C": return "#c0392b";
    case "D": return "#f1c40f";
    default: return "#888";
  }
}

// --- Geometry constants ---
const BLOCK_W = 275;
const BLOCK_X = 42;
const BLOCK_DESC_Y = 283;

const QA_BUTTON_W = 294;
const QA_BUTTON_X = 31;
const QA_BUTTON_H = 60;
const QA_BUTTON_Y_START = 180;
const QA_BUTTON_GAP = 18; // vertical gap between buttons

function isQAPage(bg) {
  return /^static\/3[a-h]\.png$/.test(bg);
}
function isOtherBlockPage(bg) {
  return (
    bg === "static/2.png" ||
    bg === "static/5a.png" ||
    bg === "static/5b.png" ||
    bg === "static/5c.png" ||
    bg === "static/5d.png" ||
    bg === "static/6.png"
  );
}

function renderBlocks(blocks, scaleX, scaleY, shrinkFactor = 0.97) {
  if (!Array.isArray(blocks)) return "";
  let html = "";
  let isQuestion = pageSequence[state.page] && pageSequence[state.page].type === "question";
  let questionIndex = null;
  if (isQuestion && quizConfig && quizConfig.questionPages) {
    const questionPages = quizConfig.questionPages;
    questionIndex = questionPages.findIndex(q => q.idx === state.page);
  }

  let answerBlockIdx = 0;

  blocks.forEach((block, idx) => {
    let type = (block.type || "").trim().toLowerCase();
    let style = "";

    if (
      type === "title" ||
      type === "description" ||
      type === "desc" ||
      type === "question"
    ) {
      // Use block's coordinates if present, otherwise default to centered
      const img = $("#quiz-bg-img");
      const imgW = img ? img.getBoundingClientRect().width : DESIGN_WIDTH;
      const widthPx = (block.width !== undefined ? block.width : imgW) * scaleX * shrinkFactor;
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

      html += `<div class="${className}" style="${style}">${block.text}</div>`;
    }
    // FIXED: Render answer blocks as colored transparent buttons at correct coordinates, expanding for text
    else if (type === "answer") {
      // Calculate color and border by answer
      let answerLetter = "";
      if (typeof block.resultType === "string" && block.resultType.length === 1) answerLetter = block.resultType.trim().toUpperCase();
      else {
        let match = /^([A-D])\./.exec(block.text.trim());
        if (match) answerLetter = match[1];
        else {
          let firstLetter = block.text.trim().charAt(0).toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(firstLetter)) answerLetter = firstLetter;
        }
      }

      let isSelected = false;
      if (questionIndex !== null && quizConfig && quizConfig.userAnswers) {
        isSelected = quizConfig.userAnswers[questionIndex] === answerLetter;
      }

      let btnClass = "block-answer-btn";
      if (isSelected) btnClass += " selected";

      let btnColor = getAnswerColor(answerLetter);
      let borderColor = getAnswerBorderColor(answerLetter);

      // Measure if answer needs double height
      let textLines = block.text.split('\n').length;
      let isDouble = block.text.length > 60 || textLines > 1;
      let btnH = isDouble ? BUTTON_H_DOUBLE : BUTTON_H_SINGLE;

      // Calculate position as per spec
      let leftPx = BUTTON_X * scaleX * shrinkFactor;
      let topPx = (BUTTON_Y_START + (answerBlockIdx * BUTTON_Y_GAP)) * scaleY * shrinkFactor;
      let widthPx = BUTTON_W * scaleX * shrinkFactor;
      let heightPx = btnH * scaleY * shrinkFactor;

      let btnStyle = `
        position:absolute;
        left:${leftPx}px;top:${topPx}px;
        width:${widthPx}px;height:${heightPx}px;
        background:${btnColor};
        border:2.5px solid ${borderColor};
        border-radius:18px;
        color:#fff;
        font-size:1.13em;
        cursor:pointer;
        font-weight:700;
        box-shadow:0 2px 12px rgba(0,0,0,0.08);
        outline:none;
        z-index:10;
        display:flex;
        align-items:center;
        justify-content:center;
        opacity:0.97;
        transition:background 0.18s,border 0.18s;
        padding:0px 10px;
        text-align:center;
        white-space:pre-line;word-break:break-word;overflow-wrap:break-word;
      `;
      if (isSelected) {
        btnStyle += `box-shadow:0 0 0 4px ${borderColor};background:${btnColor.replace('0.35','0.80')};`;
      }

      html += `<button type="button" class="${btnClass}" style="${btnStyle}" data-answer="${answerLetter}" data-question-index="${questionIndex !== null ? questionIndex : ''}">${block.text}</button>`;

      answerBlockIdx++;
    }
    else if (type === "result") {
      const img = $("#quiz-bg-img");
      const imgW = img ? img.getBoundingClientRect().width : DESIGN_WIDTH;
      const widthPx = imgW * scaleX * shrinkFactor;
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
      html += `<div class="block-result" style="${style}">${block.text}</div>`;
    }
  });
  return html;
}

function render() {
  if (!ensureApp()) return;
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
      if (quizConfig) {
        SHOW_RESULT = quizConfig.calculateResultType();
      }
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

  if (current.type === "cover") {
    app.innerHTML = `
      <div class="cover-outer">
        <div class="cover-image-container">
          <img class="cover-img" src="${current.bg}" alt="cover"/>
          <button class="main-btn cover-btn-in-img" id="startBtn">${nextLabel}</button>
        </div>
      </div>
    `;
    setTimeout(() => {
      const startBtn = $("#startBtn");
      if (startBtn) {
        startBtn.onclick = async () => {
          startBtn.disabled = true;
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
                quizConfig = config;
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
      }
    }, 0);
    return;
  }

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
      const rect = img.getBoundingClientRect();
      const displayW = rect.width;
      const displayH = rect.height;

      const overlay = $("#block-overlay-layer");
      overlay.style.width = displayW + "px";
      overlay.style.height = displayH + "px";
      overlay.style.left = "0px";
      overlay.style.top = "0px";

      overlay.innerHTML = renderBlocks(current.blocks, displayW / DESIGN_WIDTH, displayH / DESIGN_HEIGHT, 0.97);

      // Attach answer button listeners for question pages
      if (current.type === "question" && quizConfig) {
        const answerBtns = overlay.querySelectorAll(".block-answer-btn");
        answerBtns.forEach(btn => {
          btn.onclick = () => {
            let answerLetter = btn.getAttribute("data-answer");
            let questionIndex = parseInt(btn.getAttribute("data-question-index"));
            quizConfig.setAnswer(questionIndex, answerLetter);
            answerBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
          };
        });
      }
    };
    if (img.complete) img.onload();

    setTimeout(() => {
      if (current.type !== "thankyou") {
        const nextBtn = $("#nextBtn");
        if (nextBtn) nextBtn.onclick = nextAction;
      }
      if (showBack) {
        const backBtn = $("#backBtn");
        if (backBtn) {
          backBtn.onclick = () => {
            if (
              current.type === "thankyou" ||
              current.type === "resultA" ||
              current.type === "resultB" ||
              current.type === "resultC" ||
              current.type === "resultD"
            ) {
              state.page = pageSequence.findIndex(p => p.type === "pre-results");
            } else if (current.type === "pre-results") {
              state.page = pageSequence.findIndex(
                (p, i) => p.type === "question" && i > 0 && i < pageSequence.length
              ) + NUM_QUESTIONS - 1;
            } else {
              state.page = Math.max(state.page - 1, 0);
            }
            render();
          };
        }
      }
    }, 0);
    return;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    ensureApp();
    render();
  });
} else {
  ensureApp();
  render();
}
window.addEventListener("resize", render);

/* Add these styles to your CSS:

.block-answer-btn {
  border: none;
  border-radius: 18px;
  color: #fff;
  font-size: 1.13em;
  width: 100%;
  min-height: 60px;
  cursor: pointer;
  outline: none;
  font-weight: 700;
  transition: background 0.2s;
  background: rgba(255,255,255,0.05);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  white-space: pre-line;
  word-break: break-word;
  overflow-wrap: break-word;
}

.block-answer-btn.selected {
  box-shadow: 0 0 0 4px #fff;
  opacity: 1.0 !important;
}

/* Desktop/mobile tweaks */
@media (max-width: 700px) {
  .block-answer-btn {
    font-size: 1em;
    min-height: 48px;
}
*/
