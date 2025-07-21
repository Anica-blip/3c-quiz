const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// Default sequence if no quiz loaded yet
const defaultPageSequence = [
  { type: "cover", bg: "static/1.png", blocks: [] },
  { type: "intro", bg: "static/2.png", blocks: [] }
];

let pageSequence = [...defaultPageSequence];
let NUM_QUESTIONS = 8;
let SHOW_RESULT = "A";

let state = { page: 0 };

// Get quizUrl from query string
function getQuizUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("quizUrl");
}

// Fetch quiz JSON
async function fetchQuizConfig(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Quiz file not found");
    return await res.json();
  } catch (e) {
    console.error("Failed to load quiz JSON:", e);
    return null;
  }
}

// Render any block from JSON
function renderBlock(block) {
  const {
    text = "",
    x = 0, y = 0, w = 200, h = 50,
    size = 18,
    color = "#222",
    align = "left"
  } = block;
  return `
    <div class="quiz-block" style="
      position:absolute;
      left:${x}px;top:${y}px;
      width:${w}px;height:${h}px;
      font-size:${size}px;
      color:${color};
      text-align:${align};
      overflow:hidden;
      white-space:pre-line;
      pointer-events:none;
    ">
      ${text}
    </div>
  `;
}

// Button label logic
function getMainBtnLabel(current) {
  if (current.type === "cover") return "Start";
  if (current.type === "intro") return "Continue";
  if (current.type === "pre-results") return "Get Results";
  if (["resultA", "resultB", "resultC", "resultD"].includes(current.type)) return "Finish";
  return "Next";
}

function showMainBtn(current) {
  return current.type !== "thankyou";
}

function render() {
  app.innerHTML = "";
  const current = pageSequence[state.page] || {};

  // Background and blocks from JSON
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${current.bg || ""}');"></div>
    <div class="quiz-blocks-container" style="position:relative;width:100vw;height:100vh;">
      ${Array.isArray(current.blocks) ? current.blocks.map(renderBlock).join("") : ""}
    </div>
    <div class="fullscreen-bottom">
      ${state.page > 0 ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      ${showMainBtn(current) ? `<button class="main-btn" id="mainBtn">${getMainBtnLabel(current)}</button>` : ""}
    </div>
  `;

  // Button actions
  if (showMainBtn(current)) {
    $("#mainBtn").onclick = async () => {
      if (current.type === "cover") {
        // On Start, load quiz JSON if present
        const quizUrl = getQuizUrl();
        if (quizUrl) {
          const config = await fetchQuizConfig(quizUrl);
          if (config && Array.isArray(config.pages)) {
            pageSequence = config.pages;
            NUM_QUESTIONS = config.numQuestions || NUM_QUESTIONS;
            SHOW_RESULT = config.showResult || SHOW_RESULT;
            state.page = 1; // Move to intro after cover
            render();
            return;
          }
        }
        state.page++;
        render();
        return;
      }
      // Pre-results: jump to correct result page
      if (current.type === "pre-results") {
        let resultType = SHOW_RESULT || "A";
        let resultKey = "result" + resultType;
        let idx = pageSequence.findIndex(p => p.type === resultKey);
        state.page = idx >= 0 ? idx : state.page + 1;
        render();
        return;
      }
      // Results: jump to thankyou
      if (["resultA", "resultB", "resultC", "resultD"].includes(current.type)) {
        let idx = pageSequence.findIndex(p => p.type === "thankyou");
        state.page = idx >= 0 ? idx : state.page + 1;
        render();
        return;
      }
      // Otherwise, just go to next page
      state.page = Math.min(state.page + 1, pageSequence.length - 1);
      render();
    };
  }
  if (state.page > 0) {
    $("#backBtn").onclick = () => {
      // Go back logic
      if (
        current.type === "thankyou" ||
        ["resultA", "resultB", "resultC", "resultD"].includes(current.type)
      ) {
        // Back from result/thankyou: go to pre-results
        let idx = pageSequence.findIndex(p => p.type === "pre-results");
        state.page = idx >= 0 ? idx : Math.max(state.page - 1, 0);
      } else if (current.type === "pre-results") {
        // Back from pre-results: go to last question
        let idx = pageSequence
          .map((p, i) => (p.type === "question" ? i : -1))
          .filter(i => i >= 0)
          .pop();
        state.page = idx !== undefined ? idx : Math.max(state.page - 1, 0);
      } else {
        state.page = Math.max(state.page - 1, 0);
      }
      render();
    };
  }
}

// Start app
render();
