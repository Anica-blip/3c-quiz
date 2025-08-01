const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// Editor grid reference for all block coordinates (update if your admin/editor changed)
const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 600;

// --- Loader logic: FIXED to robustly parse answers by letter for ALL quizzes ---
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
          // Find answer blocks, extract code robustly
          let answers = p.blocks
            .filter(b => b.type === "answer")
            .map(b => {
              // Try resultType if present
              if (typeof b.resultType === "string" && b.resultType.length === 1)
                return b.resultType.trim().toUpperCase();
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

    // --- Robust answer/result logic for ALL quizzes ---
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
      debugQuizAnswerLogic
    };
  } catch (err) {
    return { error: err.message || "Unknown error during quiz fetch." };
  }
}

// --- Everything below is the original app loader logic ---
// Only ADD the transparent overlays to answers and ENTER button logic (no other code/layout changes)

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
let selectedAnswerIdx = null;

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

// --- Render blocks with answer overlays and selection color ---
function renderBlocks(blocks, scaleX, scaleY, shrinkFactor = 0.97, questionPageIndex = null, answerBlockCodes = [], selectedIdx = null) {
  if (!Array.isArray(blocks)) return "";
  let html = "";
  const currentBg = pageSequence[state.page]?.bg || "";

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

  blocks.forEach((block, idx) => {
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

      // Only for answer blocks: overlay transparent colored clickable div (ALWAYS present)
      if (type === "answer" && questionPageIndex !== null && answerBlockCodes[idx]) {
        let code = answerBlockCodes[idx];
        let overlayColor = "rgba(255,0,0,0.12)"; // default A = light red
        if (code === "B") overlayColor = "rgba(0,128,255,0.12)"; // B = light blue
        else if (code === "C") overlayColor = "rgba(0,200,0,0.12)"; // C = light green
        else if (code === "D") overlayColor = "rgba(255,200,0,0.12)"; // D = light yellow

        // Highlight overlay if selected
        let selectedStyle = "";
        if (selectedIdx === idx) {
          overlayColor = overlayColor.replace("0.12", "0.4");
          selectedStyle = "box-shadow:0 0 0 3px #222;outline:2px solid #222;";
        }

        html += `<div class="answer-overlay-div" 
          data-question="${questionPageIndex}" 
          data-answer="${code}"
          data-idx="${idx}"
          style="position:absolute;left:${leftPx.toFixed(2)}px;${block.y !== undefined ? `top:${(block.y * scaleY * shrinkFactor).toFixed(2)}px;` : ""}width:${widthPx.toFixed(2)}px;${block.height !== undefined ? `height:${(block.height * scaleY * shrinkFactor).toFixed(2)}px;` : ""}
          background:${overlayColor};opacity:0.7;z-index:20;cursor:pointer;${selectedStyle}">
        </div>`;
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

  // For question pages, ENTER button only appears after answer selection
  let showEnterBtn = true;
  if (
    current.type === "question" &&
    [
      "static/3a.png",
      "static/3b.png",
      "static/3c.png",
      "static/3d.png",
      "static/3e.png",
      "static/3f.png",
      "static/3g.png",
      "static/3h.png"
    ].includes(current.bg)
  ) {
    showEnterBtn = selectedAnswerIdx !== null;
  }

  let nextAction = () => {
    selectedAnswerIdx = null;
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

  if (
    ["intro", "question", "pre-results", "resultA", "resultB", "resultC", "resultD", "thankyou"].includes(current.type)
  ) {
    // For question pages, prepare answer codes for overlay logic
    let questionPageIndex = null;
    let answerBlockCodes = [];
    if (current.type === "question") {
      questionPageIndex = state.page;
      let questionBlocks = current.blocks.filter(b => b.type === "answer");
      answerBlockCodes = questionBlocks.map(b => {
        if (typeof b.resultType === "string" && b.resultType.length === 1)
          return b.resultType.trim().toUpperCase();
        let match = /^([A-D])\./.exec(b.text.trim());
        if (match) return match[1];
        let firstLetter = b.text.trim().charAt(0).toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(firstLetter)) return firstLetter;
        return '';
      });
    }

    app.innerHTML = `
      <div id="quiz-img-wrap" style="display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:auto;">
        <div id="img-block-container" style="position:relative;overflow:visible;">
          <img id="quiz-bg-img" src="${current.bg}" alt="quiz background" style="display:block;width:auto;height:auto;max-width:96vw;max-height:90vh;" />
          <div id="block-overlay-layer" style="position:absolute;left:0;top:0;pointer-events:auto;"></div>
        </div>
      </div>
      <div class="fullscreen-bottom">
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
        ${showEnterBtn && current.type !== "thankyou" ? `<button class="main-btn" id="nextBtn">${nextLabel}</button>` : ""}
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

      const scaleX = displayW / DESIGN_WIDTH;
      const scaleY = displayH / DESIGN_HEIGHT;

      overlay.innerHTML = renderBlocks(
        current.blocks,
        scaleX,
        scaleY,
        0.97,
        questionPageIndex,
        answerBlockCodes,
        selectedAnswerIdx
      );

      // Overlay answer blocks: always present, always clickable
      if (current.type === "question" && questionPageIndex !== null && answerBlockCodes.length) {
        overlay.querySelectorAll(".answer-overlay-div").forEach((div) => {
          div.onclick = (e) => {
            const answerCode = div.getAttribute("data-answer");
            const idx = parseInt(div.getAttribute("data-idx"));
            selectedAnswerIdx = idx;
            if (window.quizData && typeof window.quizData.setAnswer === "function") {
              window.quizData.setAnswer(questionPageIndex, answerCode);
            }
            render(); // to show ENTER button and highlight
          };
        });
      }
    };
    if (img.complete) img.onload();

    if (showEnterBtn && current.type !== "thankyou" && $("#nextBtn")) $("#nextBtn").onclick = nextAction;
    if (showBack && $("#backBtn")) {
      $("#backBtn").onclick = () => {
        selectedAnswerIdx = null;
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
    return;
  }
}

render();
window.addEventListener("resize", render);

// Make quizData global for overlays logic
window.quizData = null;
const quizUrlParam = getQuizUrlParam();
if (quizUrlParam) {
  fetchQuizFromRepoByQuizUrl(quizUrlParam).then(config => {
    window.quizData = config;
  });
}
