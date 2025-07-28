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
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
};

function getQuizUrl() {
  const params = new URLSearchParams(window.location.search);
  const quizUrl = params.get("quizUrl");
  return quizUrl && quizUrl.trim() !== "" ? quizUrl : null;
}

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

async function fetchQuizFromSupabaseByUrlOrSlug(quizUrlOrSlug) {
  try {
    await initSupabase();
    const { data, error } = await supabase
  .from('quizzes')
  .select('*')
  .or(`quiz_url.eq."${quizUrlOrSlug}",quiz_slug.eq."${quizUrlOrSlug}"`)
  .limit(1)
  .maybeSingle();

    console.log('Supabase raw response (by url/slug):', { data, error });if (!data) {
    console.warn("No matching quiz found for quizUrl:", quizUrlOrSlug);
  }

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
    return {
      pages,
      numQuestions: Array.isArray(pages) ? pages.filter(p => p.type === "question").length : 0,
      showResult: "A",
    };
  } catch (e) {
    console.error("Failed to fetch quiz by url/slug from Supabase:", e);
    return null;
  }
}

async function fetchLatestQuizFromSupabase() {
  try {
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
    return {
      pages,
      numQuestions: Array.isArray(pages) ? pages.filter(p => p.type === "question").length : 0,
      showResult: "A",
    };
  } catch (e) {
    console.error("Failed to fetch latest quiz from Supabase:", e);
    return null;
  }
}

// --- ONLY THIS FUNCTION IS CHANGED ---
function autoFixPages(pages) {
  // If a page is missing a 'type', assign "question" ONLY if it has answers or blocks with answers
  const fixedPages = pages.map((p, idx) => {
    if (typeof p.type === "string" && p.type.length > 0) return p;

    // If it has answers array or blocks with answer type, it's a question
    if (
      (Array.isArray(p.answers) && p.answers.length > 0) ||
      (Array.isArray(p.blocks) && p.blocks.some(b => b.type === "answer"))
    ) {
      return { ...p, type: "question" };
    }

    // Otherwise, use original heuristics for intro, thankyou, etc.
    if (idx === 0) return { ...p, type: "cover" };
    if (idx === pages.length - 1) return { ...p, type: "thankyou" };
    if (p.bg && p.bg.includes("4")) return { ...p, type: "pre-results" };
    if (p.bg && p.bg.includes("5a")) return { ...p, type: "resultA" };
    if (p.bg && p.bg.includes("5b")) return { ...p, type: "resultB" };
    if (p.bg && p.bg.includes("5c")) return { ...p, type: "resultC" };
    if (p.bg && p.bg.includes("5d")) return { ...p, type: "resultD" };
    return { ...p, type: "intro" };
  });
  return fixedPages;
}
// --- END OF CHANGE ---

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
    // Auto-fix missing type fields
    config.pages = autoFixPages(config.pages);
    console.log("Loaded (and fixed) pages from Supabase:", config.pages);
    pageSequence = config.pages;
    NUM_QUESTIONS = config.pages.filter(p => p.type === "question").length;
    SHOW_RESULT = config.showResult || SHOW_RESULT;
    state.page = 0;
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
    // --- Don't touch this: keep advancing page, not reloading Supabase ---
    $("#nextBtn").onclick = () => {
      state.page++;
      render();
    };
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

  if (current.type === "thankyou") {
    app.innerHTML = `
      <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
      <div class="page-content">
        <div class="content-inner">
          <h2>${current.type.toUpperCase()}</h2>
          <p>Insert text/content here for: <strong>${current.type}</strong> (admin app will fill this)</p>
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

  app.innerHTML = `
    <div class="fullscreen-bg" style="background-image:url('${current.bg}');"></div>
    <div class="page-content">
      <div class="content-inner">
        <h2>${current.type.toUpperCase()}</h2>
        <p>Insert text/content here for: <strong>${current.type}</strong> (admin app will fill this)</p>
      </div>
    </div>
    <div class="fullscreen-bottom">
      ${showBack ? `<button class="back-arrow-btn" id="backBtn" title="Go Back">&#8592;</button>` : ""}
      <button class="main-btn" id="nextBtn">${nextLabel}</button>
    </div>
  `;

  $("#nextBtn").onclick = nextAction;
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
        state.page = pageSequence.findIndex((p, i) => p.type === "question" && i > 0 && i < pageSequence.length) + NUM_QUESTIONS - 1;
      } else {
        state.page = Math.max(state.page - 1, 0);
      }
      render();
    };
  }
}
app.innerHTML = `
  <div class="fullscreen-bg" style="background-color: #111;"></div>
  <div class="page-content">
    <div class="content-inner">
      <h2>Loading quiz…</h2>
    </div>
  </div>
`;
handleStartButton();
