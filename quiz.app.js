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

// --- DO NOT TOUCH LOADER LOGIC ---
// --- All code below from loader to pageSequence, getQuizUrlParam, autoFixPages, renderErrorScreen is UNCHANGED ---

// Editor grid reference for all block coordinates (update if your admin/editor changed)
const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 600;

// --- Loader logic: FIXED to parse answers by letter for ALL quizzes ---
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

    // Find all question pages and their answer buttons
    let questionPages = [];
    if (Array.isArray(pages)) {
      questionPages = pages.map((p, idx) => {
        if (p.type === "question" && Array.isArray(p.blocks)) {
          // Find answer blocks, extract code
          let answers = p.blocks
            .filter(b => b.type === "answer")
            .map(b => {
              // Try resultType if present
              if (typeof b.resultType === "string" && b.resultType.length === 1) return b.resultType.trim().toUpperCase();
              // Otherwise parse "A. ..." from start of text
              let match = /^([A-D])\./.exec(b.text.trim());
              if (match) return match[1];
              // Fallback: try first letter if it's A-D
              let firstLetter = b.text.trim().charAt(0).toUpperCase();
              if (['A', 'B', 'C', 'D'].includes(firstLetter)) return firstLetter;
              // Otherwise, error
              return '';
            });
          return { idx, answers };
        }
        return null;
      }).filter(p => p !== null);
    }

    let numQuestions = questionPages.length;

    // --- Robust answer/result logic for ALL quizzes ---
    let userAnswers = [];

    // Record an answer for a question index
    function setAnswer(questionIndex, answerValue) {
      // Accept only A/B/C/D
      if (['A','B','C','D'].includes(answerValue)) {
        userAnswers[questionIndex] = answerValue;
      }
    }

    // Returns the index of the next question page
    function getNextQuestionPageIndex(currentIndex) {
      let questionIdxs = questionPages.map(q => q.idx);
      let currentQ = questionIdxs.indexOf(currentIndex);
      if (currentQ < questionIdxs.length - 1) {
        return questionIdxs[currentQ + 1];
      } else {
        // After last question, go to pre-results
        return pages.findIndex(p => p.type === "pre-results");
      }
    }

    // Returns the correct result type (A/B/C/D) based on answers
    function calculateResultType() {
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      userAnswers.forEach(ans => {
        if (typeof ans === "string") {
          const val = ans.trim().toUpperCase();
          if (counts.hasOwnProperty(val)) counts[val]++;
        }
      });
      // Find which answer has the highest count (A > B > C > D for ties)
      let max = Math.max(counts.A, counts.B, counts.C, counts.D);
      let maxTypes = [];
      for (let type of ["A", "B", "C", "D"]) {
        if (counts[type] === max && max > 0) {
          maxTypes.push(type);
        }
      }
      // If there is a tie, default to A > B > C > D priority
      for (let type of ["A", "B", "C", "D"]) {
        if (maxTypes.includes(type)) return type;
      }
      return "A";
    }

    // Returns the result page index for correct mapping
    function getResultPageIndex() {
      const resultType = calculateResultType();
      let resultPageType = "result" + resultType;
      let pageIdx = pages.findIndex(p => p.type === resultPageType);
      if (pageIdx === -1) pageIdx = pages.findIndex(p => p.type === "resultA");
      return pageIdx;
    }

    // Returns the thank you page index for workflow mapping
    function getThankYouPageIndex() {
      return pages.findIndex(p => p.type === "thankyou");
    }

    // For debugging: show quiz answer extraction logic
    function debugQuizAnswerLogic() {
      return {
        questionPages,
        userAnswers,
        resultType: calculateResultType(),
        resultPageIndex: getResultPageIndex()
      };
    }

    // Attach robust workflow to quiz object, works for ALL quizzes
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
      debugQuizAnswerLogic
    };
  } catch (err) {
    return { error: err.message || "Unknown error during quiz fetch." };
  }
}

// --- DO NOT TOUCH PAGE SEQUENCE, STATE, ETC ---
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

// --- ONLY TOUCH RENDERBLOCKS AND CSS FOR BUTTONS AND BLOCKS ---

// Block geometry for text pages
const BLOCK_W = 275;
const BLOCK_X = 42;

// Q&A button geometry
const QA_BUTTON_W = 294;
const QA_BUTTON_X = 31;
const QA_BUTTON_H = 60;
const QA_BUTTON_Y = [180, 232, 285, 339]; // Button A, B, C, D

function getAnswerColor(letter) {
  switch (letter) {
    case "A": return "rgba(52, 152, 219, 0.35)";
    case "B": return "rgba(46, 204, 113, 0.35)";
    case "C": return "rgba(231, 76, 60, 0.35)";
    case "D": return "rgba(241, 196, 15, 0.35)";
    default: return "rgba(255,255,255,0.2)";
  }
}

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
  const currentBg = pageSequence[state.page]?.bg || "";
  const isQA = isQAPage(currentBg);
  const isOtherBlock = isOtherBlockPage(currentBg);

  let isQuestion = pageSequence[state.page] && pageSequence[state.page].type === "question";
  let questionIndex = null;
  if (isQuestion && window.quizConfig && window.quizConfig.questionPages) {
    const questionPages = window.quizConfig.questionPages;
    questionIndex = questionPages.findIndex(q => q.idx === state.page);
  }

  let answerBlocks = [];
  if (isQA && isQuestion) {
    answerBlocks = blocks
      .filter(b => (b.type || "").trim().toLowerCase() === "answer")
      .map(b => {
        let letter = "";
        if (typeof b.resultType === "string" && b.resultType.length === 1) letter = b.resultType.trim().toUpperCase();
        else {
          let match = /^([A-D])\./.exec(b.text.trim());
          if (match) letter = match[1];
          else {
            let firstLetter = b.text.trim().charAt(0).toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(firstLetter)) letter = firstLetter;
          }
        }
        return { block: b, letter };
      })
      .sort((a, b) => a.letter.localeCompare(b.letter));
  }

  let answerBlockIdx = 0;

  blocks.forEach((block, idx) => {
    let type = (block.type || "").trim().toLowerCase();
    let style = "";

    // Q&A PAGE: ANSWERS ONLY
    if (isQA && type === "answer" && isQuestion) {
      let sorted = answerBlocks[answerBlockIdx];
      block = sorted.block;
      let answerLetter = sorted.letter;

      let isSelected = false;
      if (questionIndex !== null && window.quizConfig && window.quizConfig.userAnswers) {
        isSelected = window.quizConfig.userAnswers[questionIndex] === answerLetter;
      }

      let btnClass = "block-answer-btn";
      if (isSelected) btnClass += " selected";

      let btnColor = getAnswerColor(answerLetter);

      let leftPx = QA_BUTTON_X * scaleX * shrinkFactor;
      let topPx = QA_BUTTON_Y[answerBlockIdx] * scaleY * shrinkFactor;
      let widthPx = QA_BUTTON_W * scaleX * shrinkFactor;
      let heightPx = QA_BUTTON_H * scaleY * shrinkFactor;

      let btnStyle = `
        position:absolute;
        left:${leftPx}px;top:${topPx}px;
        width:${widthPx}px;height:${heightPx}px;
        background:${btnColor};
        border:none;
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
        transition:background 0.18s;
        padding-left:18px;
        padding-right:10px;
        text-align:center;
        white-space:pre-line;word-break:break-word;overflow-wrap:break-word;
        margin-bottom:18px;
      `;

      html += `<button type="button" class="${btnClass}" style="${btnStyle}" data-answer="${answerLetter}" data-question-index="${questionIndex !== null ? questionIndex : ''}">${block.text}</button>`;
      answerBlockIdx++;
      return;
    }

    // Q&A PAGE: NON-ANSWER BLOCKS (left-aligned, Q&A geometry)
    if (isQA && type !== "answer") {
      let widthPx = QA_BUTTON_W * scaleX * shrinkFactor;
      let leftPx = QA_BUTTON_X * scaleX * shrinkFactor;

      style += `left: ${leftPx.toFixed(2)}px;`;
      if (block.y !== undefined) style += `top: ${(block.y * scaleY * shrinkFactor).toFixed(2)}px;`;
      style += `width: ${widthPx.toFixed(2)}px;`;
      if (block.height !== undefined) style += `height: ${(block.height * scaleY * shrinkFactor).toFixed(2)}px;`;
      style += "position:absolute;box-sizing:border-box;overflow:hidden;";
      style += "display:block;";
      style += "white-space:pre-line;word-break:break-word;overflow-wrap:break-word;";
      style += "text-align:left;";
      if (block.fontSize) style += `font-size: ${(typeof block.fontSize === "string" ? parseFloat(block.fontSize) : block.fontSize) * scaleY * shrinkFactor}px;`;
      if (block.color) style += `color:${block.color};`;
      if (block.fontWeight) style += `font-weight:${block.fontWeight};`;
      if (block.margin !== undefined) style += `margin:${block.margin};`;
      if (block.lineHeight) style += `line-height:${block.lineHeight};`;

      let className = "";
      if (type === "title") className = "block-title";
      else if (type === "description" || type === "desc") className = "block-desc";
      else if (type === "question") className = "block-question";
      else if (type === "result") className = "block-result";

      html += `<div class="${className}" style="${style}">${block.text}</div>`;
      return;
    }

    // OTHER PAGES: ONLY FIX BLOCK WIDTH/MARGIN/Y for description, DO NOT CENTER TEXT
    if (isOtherBlock) {
      let widthPx = BLOCK_W * scaleX * shrinkFactor;
      let leftPx = BLOCK_X * scaleX * shrinkFactor;

      // Title: W 275 & X 42, Description: W 275 & X 42 x Y 283
      if (type === "title") {
        style += `left: ${leftPx.toFixed(2)}px;top: 0px;`;
      }
      else if (type === "description" || type === "desc") {
        style += `left: ${leftPx.toFixed(2)}px;top: ${(283 * scaleY * shrinkFactor)}px;`;
      }
      else {
        style += `left: ${leftPx.toFixed(2)}px;`;
        if (block.y !== undefined) style += `top: ${(block.y * scaleY * shrinkFactor).toFixed(2)}px;`;
      }
      style += `width: ${widthPx.toFixed(2)}px;`;
      if (block.height !== undefined) style += `height: ${(block.height * scaleY * shrinkFactor).toFixed(2)}px;`;

      style += "position:absolute;box-sizing:border-box;overflow:hidden;";
      style += "display:block;";
      style += "white-space:pre-line;word-break:break-word;overflow-wrap:break-word;";
      style += "text-align:left;";
      if (block.fontSize) style += `font-size: ${(typeof block.fontSize === "string" ? parseFloat(block.fontSize) : block.fontSize) * scaleY * shrinkFactor}px;`;
      if (block.color) style += `color:${block.color};`;
      if (block.fontWeight) style += `font-weight:${block.fontWeight};`;
      if (block.margin !== undefined) style += `margin:${block.margin};`;
      if (block.lineHeight) style += `line-height:${block.lineHeight};`;

      let className = "";
      if (type === "title") className = "block-title";
      else if (type === "description" || type === "desc") className = "block-desc";
      else if (type === "question") className = "block-question";
      else if (type === "result") className = "block-result";

      html += `<div class="${className}" style="${style}">${block.text}</div>`;
      return;
    }

    // ALL OTHER PAGES: untouched original logic
    let img = $("#quiz-bg-img");
    let imgW = img ? img.getBoundingClientRect().width : DESIGN_WIDTH;
    let blockWidthDesign = imgW;
    let widthPx = blockWidthDesign * scaleX * shrinkFactor;
    let leftPx = (imgW - widthPx) / 2;

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
    else if (type === "result") className = "block-result";

    html += `<div class="${className}" style="${style}">${block.text}</div>`;
  });
  return html;
}

function render() {
  ensureApp();
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
      if (window.quizConfig) {
        SHOW_RESULT = window.quizConfig.calculateResultType();
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
                window.quizConfig = config;
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
    const isQA = isQAPage(current.bg);
    const isOtherBlock = isOtherBlockPage(current.bg);
    const designW = isQA ? QA_BUTTON_W : (isOtherBlock ? BLOCK_W : DESIGN_WIDTH);
    const designH = isQA ? DESIGN_HEIGHT : DESIGN_HEIGHT;

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

      overlay.innerHTML = renderBlocks(current.blocks, displayW / designW, displayH / designH, 0.97);

      // Attach answer button listeners for question pages (Q&A only)
      if (isQA && current.type === "question" && window.quizConfig) {
        const answerBtns = overlay.querySelectorAll(".block-answer-btn");
        answerBtns.forEach(btn => {
          btn.onclick = () => {
            let answerLetter = btn.getAttribute("data-answer");
            let questionIndex = parseInt(btn.getAttribute("data-question-index"));
            window.quizConfig.setAnswer(questionIndex, answerLetter);
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

render();
window.addEventListener("resize", render);

/* Add these styles to your CSS:

.block-answer-btn {
  border: none;
  border-radius: 18px;
  color: #fff;
  font-size: 1.13em;
  width: 100%;
  cursor: pointer;
  outline: none;
  margin-bottom: 18px; /* increased space between buttons */
  font-weight: 700;
  transition: background 0.2s;
  background: rgba(255,255,255,0.05);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: pre-line;
  word-break: break-word;
  overflow-wrap: break-word;
}

.block-answer-btn.selected {
  box-shadow: 0 0 0 4px #fff;
  opacity: 1.0 !important;
}
*/
