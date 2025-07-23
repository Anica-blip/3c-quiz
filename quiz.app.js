const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// --- SUPABASE INITIALIZATION (your values) ---
const SUPABASE_URL = "https://cgxjqsbrditbteqhdyus.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneGpxc2JyZGl0YnRlcWhkeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTY1ODEsImV4cCI6MjA2NjY5MjU4MX0.xUDy5ic-r52kmRtocdcW8Np9-lczjMZ6YKPXc03rIG4";

function loadSupabaseClient() {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

let supabase;
async function initSupabase() {
  await loadSupabaseClient();
  if (!window.supabase) throw new Error('Supabase JS failed to load');
  if (!supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
let answers = [];

let state = {
  page: 0,
};

function getQuizUrl() {
  const params = new URLSearchParams(window.location.search);
  const quizUrl = params.get("quizUrl");
  return quizUrl && quizUrl.trim() !== "" ? quizUrl : null;
}

async function fetchQuizFromSupabaseByUrlOrSlug(quizUrlOrSlug) {
  await initSupabase();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .or(`quiz_url.eq.${quizUrlOrSlug},quiz_slug.eq.${quizUrlOrSlug}`)
    .limit(1)
    .maybeSingle();

  console.log('Supabase raw response (by url/slug):', { data, error });

  if (error || !data) throw error || new Error("No quiz found in Supabase for this url/slug");

  let pages = data.pages;
  if (typeof pages === "string") {
    try {
      pages = JSON.parse(pages);
    } catch (e) {
      console.error("Could not parse pages JSON string from Supabase:", pages);
      throw new Error("Quiz 'pages' column is not valid JSON.");
    }
  }
  return { pages };
}

async function fetchLatestQuizFromSupabase() {
  await initSupabase();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('Supabase raw response (latest):', { data, error });

  if (error || !data) throw error || new Error("No quiz found in Supabase");

  let pages = data.pages;
  if (typeof pages === "string") {
    try {
      pages = JSON.parse(pages);
    } catch (e) {
      console.error("Could not parse pages JSON string from Supabase:", pages);
      throw new Error("Quiz 'pages' column is not valid JSON.");
    }
  }
  return { pages };
}

// MINIMAL PATCH: For any page missing "type", show a clear error and skip it in the questions count.
async function handleStartButton() {
  let quizUrl = getQuizUrl();
  let config = null;
  if (quizUrl) {
    config = await fetchQuizFromSupabaseByUrlOrSlug(quizUrl);
    console.log('Supabase config (by url/slug):', config);
  } else {
    config = await fetchLatestQuizFromSupabase();
    console.log('Supabase config (latest):', config);
  }
  if (config && Array.isArray(config.pages) && config.pages.length > 0) {
    pageSequence = config.pages;
    // Log all page types, warn if undefined
    console.log("Supabase loaded page types:", pageSequence.map((p, i) => `#${i} type=${p && p.type}`));
    pageSequence.forEach((p, i) => {
      if (!p.type) {
        console.error(`Page at index ${i} missing "type" field!`);
      }
    });
    NUM_QUESTIONS = pageSequence.filter(p => p && typeof p.type === "string" && p.type.toLowerCase() === "question").length;
    SHOW_RESULT = "A";
    answers = [];
    state.page = 0;
    console.log("Loaded pages from Supabase:", pageSequence);
    console.log("Number of questions:", NUM_QUESTIONS);
    render();
  } else {
    renderErrorScreen();
    console.log('Config object:', config);
  }
}

function renderErrorScreen(extra = "") {
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-color:#111"></div>
    <div class="page-content">
      <div class="content-inner">
        <h2>Error: No page data</h2>
        <p>The quiz could not be loaded or is empty or the page is malformed. Please check your Supabase data.</p>
        ${extra}
        <div>
          <img src="static/error-illustration.png" alt="error" style="margin-top:24px;max-width:120px;opacity:.5;"/>
        </div>
      </div>
    </div>
  `;
}

function renderFullscreenBgPage({ bg, button, showBack }) {
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${bg}');"></div>
    <div class="fullscreen-bottom">
      ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      ${button ? `<button class="main-btn" id="${button.id}">${button.label}</button>` : ""}
    </div>
  `;
  if (showBack) {
    $("#backBtn").onclick = () => {
      state.page = Math.max(0, state.page - 1);
      render();
    };
  }
  if (button) {
    $(`#${button.id}`).onclick = button.onClick;
  }
}

function render() {
  app.innerHTML = "";
  const current = pageSequence[state.page];

  if (!current || typeof current.type !== "string") {
    let pageNum = state.page + 1;
    renderErrorScreen(`<p>Bad page at index <b>${state.page}</b> (page #${pageNum}).<br/>Try navigating next or back.<br/>Page data:<br/><pre>${JSON.stringify(current, null, 2)}</pre></p>
      <div class="fullscreen-bottom">
        <button class="main-btn" id="nextBtn">Next</button>
        <button class="main-btn" id="backBtn">Back</button>
      </div>
      <div>
        <img src="static/1.png" alt="error" style="margin-top:24px;max-width:120px;opacity:.5;"/>
      </div>
    `);

    // Let user try to skip forward or back
    const next = () => {
      state.page = Math.min(state.page + 1, pageSequence.length - 1);
      render();
    };
    const back = () => {
      state.page = Math.max(state.page - 1, 0);
      render();
    };
    document.getElementById("nextBtn").onclick = next;
    document.getElementById("backBtn").onclick = back;
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
      // Evaluate answers to choose result (here just always "A", you must implement your logic)
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
          <button class="main-btn cover-btn-in-img" id="nextBtn">${nextLabel}</button>
        </div>
      </div>
    `;
    $("#nextBtn").onclick = handleStartButton;
    return;
  }

  if (current.type === "intro") {
    renderFullscreenBgPage({
      bg: current.bg,
      button: { label: "Continue", id: "mainBtn", onClick: () => {
        state.page++;
        render();
      }},
      showBack: true
    });
    return;
  }

  // --- QUESTION PAGE RENDERING ---
  if (current.type === "question") {
    // Read question text, answers from possible Supabase page structure
    let questionText = current.question;
    let answersArr = current.answers;
    // Fallback for block-style structure (from some editors)
    if ((!questionText || !answersArr) && Array.isArray(current.blocks)) {
      questionText = (current.blocks.find(b => b.type === "title") || {}).text || "";
      answersArr = current.blocks.filter(b => b.type === "answer").map(b => ({ text: b.text, result: b.result }));
    }
    // Fallback: if still no answers, show error
    if (!Array.isArray(answersArr) || answersArr.length === 0) {
      renderErrorScreen(`<p>This question page does not have any answers defined.<br/>Page data:<br/><pre>${JSON.stringify(current, null, 2)}</pre></p>`);
      return;
    }

    // Render question UI
    app.innerHTML = `
      <div class="fullscreen-bg" style="background-image:url('${current.bg}')"></div>
      <div class="page-content">
        <div class="content-inner">
          <h2>${questionText || "Question"}</h2>
          <div class="answer-list">
            ${answersArr.map((a, idx) =>
              `<button class="answer-btn" id="ansBtn${idx}">${a.text}</button>`
            ).join("")}
          </div>
        </div>
      </div>
      <div class="fullscreen-bottom">
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      </div>
    `;

    answersArr.forEach((a, idx) => {
      $("#ansBtn" + idx).onclick = () => {
        // Save answer for scoring
        answers[state.page] = a.result;
        // Optionally: compute SHOW_RESULT here, or wait until pre-results
        state.page = Math.min(state.page + 1, pageSequence.length - 1);
        render();
      };
    });
    if (showBack) {
      $("#backBtn").onclick = () => {
        state.page = Math.max(state.page - 1, 0);
        render();
      };
    }
    return;
  }

  // --- RESULT & THANKYOU PAGES ---
  if (current.type === "thankyou") {
    app.innerHTML = `
      <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
      <div class="page-content">
        <div class="content-inner">
          <h2>Thank you!</h2>
        </div>
      </div>
      <div class="fullscreen-bottom">
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      </div>
    `;
    if (showBack) {
      $("#backBtn").onclick = () => {
        state.page = pageSequence.findIndex(p => p.type === "pre-results");
        render();
      };
    }
    return;
  }

  if (
    current.type === "resultA" ||
    current.type === "resultB" ||
    current.type === "resultC" ||
    current.type === "resultD"
  ) {
    app.innerHTML = `
      <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
      <div class="page-content">
        <div class="content-inner">
          <h2>Your Result</h2>
          <p>${current.resultText || ""}</p>
        </div>
      </div>
      <div class="fullscreen-bottom">
        <button class="main-btn" id="nextBtn">Finish</button>
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      </div>
    `;
    $("#nextBtn").onclick = nextAction;
    if (showBack) {
      $("#backBtn").onclick = () => {
        state.page = pageSequence.findIndex(p => p.type === "pre-results");
        render();
      };
    }
    return;
  }

  // --- PRE-RESULTS PAGE ---
  if (current.type === "pre-results") {
    app.innerHTML = `
      <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
      <div class="page-content">
        <div class="content-inner">
          <h2>See your result</h2>
        </div>
      </div>
      <div class="fullscreen-bottom">
        <button class="main-btn" id="nextBtn">Get Results</button>
        ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      </div>
    `;
    $("#nextBtn").onclick = () => {
      // Compute result letter from answers
      if (answers.length > 0) {
        // Count most common result letter in answers
        const counts = {};
        for (let res of answers) {
          if (res) counts[res] = (counts[res] || 0) + 1;
        }
        SHOW_RESULT = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "A";
      } else {
        SHOW_RESULT = "A";
      }
      nextAction();
    };
    if (showBack) {
      $("#backBtn").onclick = () => {
        let lastQ = -1;
        for (let i = pageSequence.length - 1; i >= 0; i--) {
          if (pageSequence[i].type === "question") {
            lastQ = i; break;
          }
        }
        if (lastQ !== -1) state.page = lastQ;
        else state.page = Math.max(state.page - 1, 0);
        render();
      };
    }
    return;
  }

  // --- DEFAULT: fallback for unknown types ---
  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
    <div class="page-content">
      <div class="content-inner">
        <h2>${current.type ? current.type.toUpperCase() : "PAGE"}</h2>
        <pre style="color:#fff;background:#181040">${JSON.stringify(current, null, 2)}</pre>
      </div>
    </div>
    <div class="fullscreen-bottom">
      ${showBack ? `<button class="main-btn" id="nextBtn">Next</button><button class="main-btn" id="backBtn">Back</button>` : `<button class="main-btn" id="nextBtn">Next</button>`}
    </div>
  `;
  $("#nextBtn").onclick = () => {
    state.page = Math.min(state.page + 1, pageSequence.length - 1);
    render();
  };
  if (showBack) {
    $("#backBtn").onclick = () => {
      state.page = Math.max(state.page - 1, 0);
      render();
    };
  }
}

render();
