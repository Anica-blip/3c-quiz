const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// Sequence of page backgrounds, in order.
// You can adjust the length of questionPages if you have fewer questions for a given quiz.
const pageSequence = [
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

// For demonstration, define number of questions and which result to show (A/B/C/D)
let NUM_QUESTIONS = 8; // use 3a-3h
let SHOW_RESULT = "A"; // can be "A", "B", "C", or "D"

let state = {
  page: 0,
};

function render() {
  app.innerHTML = "";
  const current = pageSequence[state.page];

  // If page data is missing, just show a blank fallback
  if (!current) {
    app.innerHTML = `<div class="fullscreen-bg" style="background-color:#111"></div>`;
    return;
  }

  // Set up navigation logic
  let showNext = true;
  let showBack = state.page > 0;
  let nextLabel = "Next";
  let nextAction = () => {
    // Handle jumping to correct result
    if (current.type === "pre-results") {
      // Jump to chosen result page
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
      // After result, go to thank you page
      state.page = pageSequence.findIndex(p => p.type === "thankyou");
      render();
      return;
    } else if (current.type === "thankyou") {
      // Optionally restart or do nothing
      state.page = 0;
      render();
      return;
    }
    // Otherwise, go to next page
    state.page = Math.min(state.page + 1, pageSequence.length - 1);
    render();
  };

  // Labels and actions for special cases
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
  if (current.type === "thankyou") nextLabel = "Restart";

  // Render current page
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
    <div class="page-content">
      <!-- Placeholder for text, to be filled by admin/editor app in future -->
      <div class="content-inner">
        <h2>${current.type.toUpperCase()}</h2>
        <p>Insert text/content here for: <strong>${current.type}</strong> (from admin app later)</p>
      </div>
    </div>
    <div class="fullscreen-bottom">
      ${showBack ? `<button class="main-btn" id="backBtn">Back</button>` : ""}
      ${showNext ? `<button class="main-btn" id="nextBtn">${nextLabel}</button>` : ""}
    </div>
  `;

  if (showNext) $("#nextBtn").onclick = nextAction;
  if (showBack) {
    $("#backBtn").onclick = () => {
      // Handle back navigation logic
      if (
        current.type === "thankyou" ||
        current.type === "resultA" ||
        current.type === "resultB" ||
        current.type === "resultC" ||
        current.type === "resultD"
      ) {
        // Go back to pre-results
        state.page = pageSequence.findIndex(p => p.type === "pre-results");
      } else if (current.type === "pre-results") {
        // Go back to last question
        state.page = pageSequence.findIndex((p, i) => p.type === "question" && i > 0 && i < pageSequence.length) + NUM_QUESTIONS - 1;
      } else {
        state.page = Math.max(state.page - 1, 0);
      }
      render();
    };
  }
}

render();
