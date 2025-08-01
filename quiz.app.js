const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// Editor grid reference for all block coordinates (update if your admin/editor changed)
const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 600;

// --- QUIZ LOADER LOGIC (untouched, but must support setAnswer etc.) ---
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
              if (typeof b.resultType === "string" && /^[A-D]$/.test(b.resultType.trim().toUpperCase())) {
                return b.resultType.trim().toUpperCase();
              }
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

    return {
      pages,
      numQuestions,
      showResult: data.showResult || "A",
      userAnswers,
      setAnswer,
      getNextQuestionPageIndex,
      calculateResultType,
      getResultPageIndex,
      getThankYouPageIndex
    };
  } catch (err) {
    return { error: err.message || "Unknown error during quiz fetch." };
  }
}

// --- Everything below is the app loader (UI layer): ONLY answer selection & navigation logic is changed ---
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
let quizData = null; // store loaded quiz object

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

// --- CHANGED: Render answer blocks as buttons, auto-advance and record answer ---
function renderBlocks(blocks, scaleX, scaleY, shrinkFactor = 0.97, questionPageIndex = null) {
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
      else if (type === "result") className = "block-result";

      html += `<div class="${className}" style="${style}">${block.text}</div>`;
    }

    // --- NEW: Render answer as button on question pages ---
    if (type === "answer" && questionPageIndex !== null) {
      // Find answer code (A/B/C/D)
      let answerCode = '';
      if (typeof block.resultType === "string" && /^[A-D]$/.test(block.resultType.trim().toUpperCase())) {
        answerCode = block.resultType.trim().toUpperCase();
      } else {
        let match = /^([A-D])\./.exec(block.text.trim());
        if (match) answerCode = match[1];
        else {
          let firstLetter = block.text.trim().charAt(0).toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(firstLetter)) answerCode = firstLetter;
        }
      }

      // Style for button
      const img = $("#quiz-bg-img");
      const imgW = img ? img.getBoundingClientRect().width : DESIGN_WIDTH;
      const widthPx = blockWidthDesign * scaleX * shrinkFactor;
      const leftPx = (imgW - widthPx) / 2;
      let topPx = block.y !== undefined ? (block.y * scaleY * shrinkFactor) : 0;

      html += `<button class="main-btn block-answer-btn" style="position:absolute;left:${leftPx.toFixed(2)}px;top:${topPx.toFixed(2)}px;width:${widthPx.toFixed(2)}px;" data-question="${questionPageIndex}" data-answer="${answerCode}">${block.text}</button>`;
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

  let nextAction = () => {
    if (current.type === "pre-results") {
      // Calculate and show correct result page
      SHOW_RESULT = quizData ? quizData.calculateResultType() : "A";
      let resultPageIdx = pageSequence.findIndex(p => p.type === "result" + SHOW_RESULT);
      if (resultPageIdx === -1) resultPageIdx = pageSequence.findIndex(p => p.type === "resultA");
      state.page = resultPageIdx;
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
            quizData = config; // store loaded quiz object!
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
        quizData = null;
        render();
      }
    };
    return;
  }

  // --- CHANGED: Answer selection logic for question pages ---
  if (
    ["intro", "question", "pre-results", "resultA", "resultB", "resultC", "resultD", "thankyou"].includes(current.type)
  ) {
    // Detect if this is a question page, get its index
    let questionPageIndex = null;
    if (quizData && current.type === "question" && quizData.pages) {
      questionPageIndex = quizData.pages
        .map((p, idx) => (p.type === "question" ? idx : null))
        .filter(idx => idx !== null)
        .indexOf(state.page);
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

      const scaleX = displayW / DESIGN_WIDTH;
      const scaleY = displayH / DESIGN_HEIGHT;

      overlay.innerHTML = renderBlocks(current.blocks, scaleX, scaleY, 0.97, questionPageIndex);

      // --- CHANGED: Make answer buttons interactive on question pages ---
      if (current.type === "question" && questionPageIndex !== null) {
        overlay.querySelectorAll(".block-answer-btn").forEach((btn) => {
          btn.onclick = (e) => {
            const answerCode = btn.getAttribute("data-answer");
            if (quizData && typeof quizData.setAnswer === "function") {
              quizData.setAnswer(questionPageIndex, answerCode);
            }
            // Advance to next question or pre-results
            if (quizData && typeof quizData.getNextQuestionPageIndex === "function") {
              const nextIdx = quizData.getNextQuestionPageIndex(state.page);
              state.page = nextIdx;
              render();
            }
          };
        });
        // Remove NEXT button on question pages
        const nextBtn = $("#nextBtn");
        if (nextBtn) nextBtn.style.display = "none";
      }
    };
    if (img.complete) img.onload();

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
