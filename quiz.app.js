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

const DESIGN_WIDTH = 350;
const DESIGN_HEIGHT = 600;

// --- Loader logic (FIXED) ---
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
      questionPages
    };
  } catch (err) {
    console.error("Quiz fetch error:", err);
    return { error: err.message || "Unknown error during quiz fetch." };
  }
}

// --- Default fallback pages ---
const defaultPageSequence = [
  { type: "cover", bg: "static/1.png" },
  { type: "intro", bg: "static/2.png" },
  { type: "question", bg: "static/3a.png", blocks: [
    { type: "question", text: "Sample Question 1", y: 120, height: 40, fontSize: 18, color: "#fff", fontWeight: "bold" },
    { type: "answer", text: "A. Sample Answer A", resultType: "A" },
    { type: "answer", text: "B. Sample Answer B", resultType: "B" },
    { type: "answer", text: "C. Sample Answer C", resultType: "C" },
    { type: "answer", text: "D. Sample Answer D", resultType: "D" }
  ]},
  { type: "question", bg: "static/3b.png", blocks: [
    { type: "question", text: "Sample Question 2", y: 120, height: 40, fontSize: 18, color: "#fff", fontWeight: "bold" },
    { type: "answer", text: "A. Sample Answer A", resultType: "A" },
    { type: "answer", text: "B. Sample Answer B", resultType: "B" },
    { type: "answer", text: "C. Sample Answer C", resultType: "C" },
    { type: "answer", text: "D. Sample Answer D", resultType: "D" }
  ]},
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
  quizError: "",
  isLoading: false
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
    <div style="background-color:#111;min-height:100vh;width:100vw;display:flex;align-items:center;justify-content:center;">
      <div style="color:#fff;text-align:center;padding:20px;max-width:80vw;">
        <h2>Error: Quiz Loading Failed</h2>
        <p>The quiz could not be loaded. Please check your quiz data or network connection.</p>
        ${extra}
        <div style="margin-top:2em;">
          <button class="main-btn" onclick="window.location.reload()" style="background:#007bff;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;">Reload</button>
        </div>
      </div>
    </div>
  `;
}

function renderLoadingScreen() {
  if (!ensureApp()) return;
  app.innerHTML = `
    <div style="background-color:#111;min-height:100vh;width:100vw;display:flex;align-items:center;justify-content:center;">
      <div style="color:#fff;text-align:center;padding:20px;">
        <h2>Loading Quiz...</h2>
        <div style="margin-top:20px;">
          <div style="width:50px;height:50px;border:5px solid #333;border-top:5px solid #007bff;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div>
        </div>
      </div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
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

function getAnswerColor(letter) {
  switch (letter) {
    case "A": return "rgba(52, 152, 219, 0.35)";
    case "B": return "rgba(46, 204, 113, 0.35)";
    case "C": return "rgba(231, 76, 60, 0.35)";
    case "D": return "rgba(241, 196, 15, 0.35)";
    default: return "rgba(255,255,255,0.2)";
  }
}

// --- DOM rendering ---
function renderBlocks(blocks, scaleX, scaleY, shrinkFactor = 0.97) {
  if (!Array.isArray(blocks)) return "";
  let html = "";
  const currentBg = pageSequence[state.page]?.bg || "";
  const isQA = isQAPage(currentBg);
  const isOtherBlock = isOtherBlockPage(currentBg);

  let isQuestion = pageSequence[state.page] && pageSequence[state.page].type === "question";
  let questionIndex = null;
  if (isQuestion && quizConfig && quizConfig.questionPages) {
    const questionPages = quizConfig.questionPages;
    questionIndex = questionPages.findIndex(q => q.idx === state.page);
  }

  // For Q&A page, collect answer blocks sorted by answer letter
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

  // --- Render non-answer blocks (for Q&A and info/result pages) ---
  blocks.forEach((block, idx) => {
    let type = (block.type || "").trim().toLowerCase();
    let style = "";

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

    // --- Render info/result blocks ---
    if (isOtherBlock) {
      let widthPx = BLOCK_W * scaleX * shrinkFactor;
      let leftPx = BLOCK_X * scaleX * shrinkFactor;

      if (type === "title") {
        style += `left: ${leftPx.toFixed(2)}px;top: 0px;`;
      }
      else if (type === "description" || type === "desc") {
        style += `left: ${leftPx.toFixed(2)}px;top: ${(BLOCK_DESC_Y * scaleY * shrinkFactor)}px;`;
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
  });

  // --- Render answer buttons for Q&A page ---
  if (isQA && isQuestion) {
    // We'll render a placeholder for each button, and after DOM is built, we'll position them dynamically
    html += `<div id="dynamic-answer-buttons"></div>`;
  }

  return html;
}

function render() {
  if (!ensureApp()) return;
  
  // Show loading screen if loading
  if (state.isLoading) {
    renderLoadingScreen();
    return;
  }

  // Show error screen if there's an error
  if (state.quizError) {
    renderErrorScreen(`<div style="color:#f00"><strong>${state.quizError}</strong></div>`);
    return;
  }

  app.innerHTML = "";
  const current = pageSequence[state.page];

  if (!current || typeof current.type !== "string") {
    renderErrorScreen("<div style='color:#f00'>Invalid page data.</div>");
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
      <div class="cover-outer" style="width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:#000;">
        <div class="cover-image-container" style="position:relative;max-width:96vw;max-height:90vh;">
          <img class="cover-img" src="${current.bg}" alt="cover" style="width:auto;height:auto;max-width:100%;max-height:100%;display:block;"/>
          <button class="main-btn cover-btn-in-img" id="startBtn" style="position:absolute;bottom:50px;left:50%;transform:translateX(-50%);background:#007bff;color:#fff;border:none;padding:16px 32px;border-radius:25px;font-size:18px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,123,255,0.3);transition:all 0.3s ease;">${nextLabel}</button>
        </div>
      </div>
    `;
    setTimeout(() => {
      const startBtn = $("#startBtn");
      if (startBtn) {
        // Add hover effect
        startBtn.onmouseenter = () => {
          startBtn.style.background = "#0056b3";
          startBtn.style.transform = "translateX(-50%) translateY(-2px)";
        };
        startBtn.onmouseleave = () => {
          startBtn.style.background = "#007bff";
          startBtn.style.transform = "translateX(-50%) translateY(0)";
        };
        
        startBtn.onclick = async () => {
          startBtn.disabled = true;
          startBtn.style.opacity = "0.6";
          startBtn.textContent = "Loading...";
          
          const quizUrlParam = getQuizUrlParam();
          
          if (quizUrlParam) {
            state.isLoading = true;
            render(); // Show loading screen
            
            try {
              const config = await fetchQuizFromRepoByQuizUrl(quizUrlParam);

              if (config && config.error) {
                state.isLoading = false;
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
                state.isLoading = false;
                quizConfig = config;
                console.log("Quiz loaded successfully:", config);
                render();
              } else {
                state.isLoading = false;
                state.quizError = "No quiz data loaded from repository!";
                render();
              }
            } catch (err) {
              console.error("Quiz loading error:", err);
              state.isLoading = false;
              state.quizError = err.message || "Error loading quiz from repository.";
              render();
            }
          } else {
            // No quiz URL, use default pages
            state.page = 1;
            state.quizLoaded = true;
            state.quizError = "";
            state.isLoading = false;
            console.log("Using default quiz pages");
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
      <div id="quiz-img-wrap" style="display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:auto;background:#000;">
        <div id="img-block-container" style="position:relative;overflow:visible;">
          <img id="quiz-bg-img" src="${current.bg}" alt="quiz background" style="display:block;width:auto;height:auto;max-width:96vw;max-height:90vh;" />
          <div id="block-overlay-layer" style="position:absolute;left:0;top:0;pointer-events:none;"></div>
        </div>
      </div>
      <div class="fullscreen-bottom" style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:15px;z-index:1000;">
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back" style="background:rgba(255,255,255,0.1);color:#fff;border:none;width:50px;height:50px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);">&#8592;</button>` : ""}
        ${current.type !== "thankyou" ? `<button class="main-btn" id="nextBtn" style="background:#007bff;color:#fff;border:none;padding:12px 24px;border-radius:25px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,123,255,0.3);">${nextLabel}</button>` : ""}
      </div>
    `;
    
    const img = $("#quiz-bg-img");
    const handleImageLoad = () => {
      const rect = img.getBoundingClientRect();
      const displayW = rect.width;
      const displayH = rect.height;

      const overlay = $("#block-overlay-layer");
      overlay.style.width = displayW + "px";
      overlay.style.height = displayH + "px";
      overlay.style.left = "0px";
      overlay.style.top = "0px";

      overlay.innerHTML = renderBlocks(current.blocks || [], displayW / DESIGN_WIDTH, displayH / DESIGN_HEIGHT, 0.97);

      // --- Dynamic Q&A answer button rendering ---
      if (isQAPage(current.bg) && current.type === "question") {
        let blocks = (current.blocks || []).filter(b => (b.type || "").trim().toLowerCase() === "answer")
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

        let questionIndex = 0;
        if (quizConfig && quizConfig.questionPages) {
          questionIndex = quizConfig.questionPages.findIndex(q => q.idx === state.page);
          if (questionIndex === -1) questionIndex = 0;
        }

        const answerLayer = overlay.querySelector("#dynamic-answer-buttons");
        if (answerLayer) {
          answerLayer.innerHTML = "";
          answerLayer.style.pointerEvents = "auto";

          // Place buttons dynamically
          let yCurrent = QA_BUTTON_Y_START * (displayH / DESIGN_HEIGHT) * 0.97;
          let btnGap = QA_BUTTON_GAP * (displayH / DESIGN_HEIGHT) * 0.97;
          let btnW = QA_BUTTON_W * (displayW / DESIGN_WIDTH) * 0.97;
          let btnX = QA_BUTTON_X * (displayW / DESIGN_WIDTH) * 0.97;

          blocks.forEach((answer, idx) => {
            let isSelected = false;
            if (quizConfig && quizConfig.userAnswers) {
              isSelected = quizConfig.userAnswers[questionIndex] === answer.letter;
            }
            let btnColor = getAnswerColor(answer.letter);

            // Create button element
            let btn = document.createElement("button");
            btn.type = "button";
            btn.className = "block-answer-btn" + (isSelected ? " selected" : "");
            btn.setAttribute("data-answer", answer.letter);
            btn.setAttribute("data-question-index", questionIndex.toString());

            btn.style.position = "absolute";
            btn.style.left = btnX + "px";
            btn.style.top = yCurrent + "px";
            btn.style.width = btnW + "px";
            btn.style.minHeight = (QA_BUTTON_H * (displayH / DESIGN_HEIGHT) * 0.97) + "px";
            btn.style.background = btnColor;
            btn.style.border = "none";
            btn.style.borderRadius = "18px";
            btn.style.color = "#fff";
            btn.style.fontSize = (16 * (displayH / DESIGN_HEIGHT) * 0.97) + "px";
            btn.style.cursor = "pointer";
            btn.style.fontWeight = "700";
            btn.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
            btn.style.outline = "none";
            btn.style.zIndex = "10";
            btn.style.display = "flex";
            btn.style.alignItems = "center";
            btn.style.justifyContent = "flex-start";
            btn.style.opacity = "0.97";
            btn.style.transition = "all 0.18s ease";
            btn.style.paddingLeft = "18px";
            btn.style.paddingRight = "10px";
            btn.style.paddingTop = "10px";
            btn.style.paddingBottom = "10px";
            btn.style.textAlign = "left";
            btn.style.whiteSpace = "pre-line";
            btn.style.wordBreak = "break-word";
            btn.style.overflowWrap = "break-word";

            btn.innerHTML = answer.block.text;

            // Add hover effects
            btn.onmouseenter = () => {
              if (!btn.classList.contains('selected')) {
                btn.style.opacity = "1";
                btn.style.transform = "translateY(-2px)";
                btn.style.boxShadow = "0 4px 20px rgba(0,0,0,0.15)";
              }
            };
            btn.onmouseleave = () => {
              if (!btn.classList.contains('selected')) {
                btn.style.opacity = "0.97";
                btn.style.transform = "translateY(0)";
                btn.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
              }
            };

            answerLayer.appendChild(btn);

            // Calculate next Y position based on actual button height
            setTimeout(() => {
              let actualHeight = btn.getBoundingClientRect().height;
              yCurrent += actualHeight + btnGap;
            }, 0);
          });

          // Attach click listeners
          setTimeout(() => {
            const answerBtns = answerLayer.querySelectorAll(".block-answer-btn");
            answerBtns.forEach(btn => {
              btn.onclick = () => {
                let answerLetter = btn.getAttribute("data-answer");
                let questionIndex = parseInt(btn.getAttribute("data-question-index"));
                
                // Set answer in quiz config
                if (quizConfig && quizConfig.setAnswer) {
                  quizConfig.setAnswer(questionIndex, answerLetter);
                }
                
                // Update visual selection
                answerBtns.forEach(b => {
                  b.classList.remove("selected");
                  b.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
                  b.style.opacity = "0.97";
                });
                
                btn.classList.add("selected");
                btn.style.boxShadow = "0 0 0 4px #fff";
                btn.style.opacity = "1.0";
                
                console.log(`Selected answer ${answerLetter} for question ${questionIndex}`);
              };
            });
          }, 10);
        }
      }
    };

    img.onload = handleImageLoad;
    if (img.complete) handleImageLoad();

    // Attach navigation button listeners
    setTimeout(() => {
      if (current.type !== "thankyou") {
        const nextBtn = $("#nextBtn");
        if (nextBtn) {
          nextBtn.onmouseenter = () => {
            nextBtn.style.background = "#0056b3";
            nextBtn.style.transform = "translateY(-2px)";
          };
          nextBtn.onmouseleave = () => {
            nextBtn.style.background = "#007bff";
            nextBtn.style.transform = "translateY(0)";
          };
          nextBtn.onclick = nextAction;
        }
      }
      
      if (showBack) {
        const backBtn = $("#backBtn");
        if (backBtn) {
          backBtn.onmouseenter = () => {
            backBtn.style.background = "rgba(255,255,255,0.2)";
          };
          backBtn.onmouseleave = () => {
            backBtn.style.background = "rgba(255,255,255,0.1)";
          };
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
              // Go back to last question
              let lastQuestionIdx = -1;
              for (let i = pageSequence.length - 1; i >= 0; i--) {
                if (pageSequence[i].type === "question") {
                  lastQuestionIdx = i;
                  break;
                }
              }
              if (lastQuestionIdx !== -1) {
                state.page = lastQuestionIdx;
              } else {
                state.page = Math.max(state.page - 1, 0);
              }
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

// Initialize the app
function initializeApp() {
  console.log("Initializing quiz app...");
  
  // Create default quiz config for fallback
  if (!quizConfig) {
    quizConfig = {
      pages: [...defaultPageSequence],
      numQuestions: 2, // Updated to match default questions
      showResult: "A",
      userAnswers: [],
      questionPages: [
        { idx: 2, answers: ['A', 'B', 'C', 'D'] }, // First question page
        { idx: 3, answers: ['A', 'B', 'C', 'D'] }  // Second question page
      ],
      setAnswer: function(questionIndex, answerValue) {
        if (['A','B','C','D'].includes(answerValue)) {
          this.userAnswers[questionIndex] = answerValue;
          console.log(`Answer set: Q${questionIndex} = ${answerValue}`);
        }
      },
      calculateResultType: function() {
        const counts = { A: 0, B: 0, C: 0, D: 0 };
        this.userAnswers.forEach(ans => {
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
        // Return first max type found
        for (let type of ["A", "B", "C", "D"]) {
          if (maxTypes.includes(type)) return type;
        }
        return "A";
      }
    };
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
}

// Handle window resize
window.addEventListener("resize", () => {
  if (!state.isLoading && !state.quizError) {
    render();
  }
});

// Start the app
initializeApp();
