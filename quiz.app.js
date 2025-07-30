const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// --- SUPABASE INIT ---
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

// --- MAIN LOGIC: get the current page URL including query string ---
function getCurrentLandingUrl() {
  // Always use the full URL as shown in the browser bar
  return window.location.href;
}

// --- Fetch quiz from Supabase matching quiz_url exactly ---
async function fetchQuizFromSupabaseByUrl(quizUrl) {
  await initSupabase();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('quiz_url', quizUrl)
    .limit(1)
    .maybeSingle();

  if (!data) {
    console.warn("No quiz found with quiz_url:", quizUrl);
    return null;
  }

  let pages = data.pages;
  if (typeof pages === "string") {
    try {
      pages = JSON.parse(pages);
    } catch (e) {
      console.error("Could not parse pages JSON from Supabase:", pages);
      throw new Error("Quiz 'pages' column is not valid JSON.");
    }
  }
  return {
    pages,
    numQuestions: Array.isArray(pages) ? pages.filter(p => p.type === "question").length : 0,
    showResult: "A",
  };
}

// --- Loader function ---
async function handleStartLoader() {
  const quizUrl = getCurrentLandingUrl();
  let config = await fetchQuizFromSupabaseByUrl(quizUrl);
  if (config && Array.isArray(config.pages) && config.pages.length > 0) {
    config.pages = autoFixPages(config.pages);
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

// --- Utility functions ---
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

// -- The rest of your rendering and navigation logic below --
//   (unchanged from previous versions, can copy-paste from your working code)

// For completeness, here's a minimal render function:
function render() {
  app.innerHTML = `<div>Quiz loaded. Implement your quiz rendering logic here.</div>`;
}

// --- LAUNCH ---
handleStartLoader();
