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
            console.log(`Answer set: Q${questionIndex} = ${answerValue}`, userAnswers);
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
          
          console.log("Calculating results from answers:", userAnswers);
          
          userAnswers.forEach((ans, index) => {
            if (typeof ans === "string") {
              const val = ans.trim().toUpperCase();
              if (counts.hasOwnProperty(val)) {
                counts[val]++;
                console.log(`Answer ${index}: ${val} (running totals: A:${counts.A}, B:${counts.B}, C:${counts.C}, D:${counts.D})`);
              }
            }
          });
          
          console.log("Final counts:", counts);
          
          // Find the highest score(s)
          let max = Math.max(counts.A, counts.B, counts.C, counts.D);
          console.log("Highest score:", max);
          
          if (max === 0) {
            console.log("No answers found, defaulting to A");
            return "A";
          }
          
          let maxTypes = [];
          for (let type of ["A", "B", "C", "D"]) {
            if (counts[type] === max && max > 0) {
              maxTypes.push(type);
            }
          }
          
          console.log("Max types:", maxTypes);
          
          // Return first max type found
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
        { type: "question", text: "Sample Question 1", y: 109, height: 60, fontSize: 18, color: "#fff", fontWeight: "bold" },
        { type: "answer", text: "A. Sample Answer A", resultType: "A" },
        { type: "answer", text: "B. Sample Answer B", resultType: "B" },
        { type: "answer", text: "C. Sample Answer C", resultType: "C" },
        { type: "answer", text: "D. Sample Answer D", resultType: "D" }
      ]},
      { type: "question", bg: "static/3b.png", blocks: [
        { type: "question", text: "Sample Question 2", y: 109, height: 60, fontSize: 18, color: "#fff", fontWeight: "bold" },
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
      if (!Array.isArray(pages)) return [];
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
              <button class="neon-button" onclick="window.location.reload()"
style="background:#007bff;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;">Reload</button>
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

    // --- UPDATED Page-specific positioning constants ---
    const PAGE_LAYOUTS = {
      // Cover page (1.png) - just button positioning
      cover: {},
      
      // Intro page (2.png) and Result pages (5a-5d.png)
      intro_result: {
        title: { x: 42, y: 212, width: 275, height: 60 },
        description: { x: 42, y: 283, width: 275, height: 55 }
      },
      
      // Question pages (3a-3h.png) - UPDATED WITH YOUR NEW COORDINATES
      question: {
        question: { x: 31, y: 109, width: 294, height: 60 },
        answers: {
          // Updated coordinates based on your changes: W 294, H 55, X 31, with better spacing
          A: { x: 31, y: 180, width: 294, height: 55 },  // Y 180 (your coordinate)
          B: { x: 31, y: 248, width: 294, height: 55 },  // Y 248 (your coordinate)  
          C: { x: 31, y: 318, width: 294, height: 55 },  // Y 318 (your coordinate)
          D: { x: 31, y: 387, width: 294, height: 55 }   // Y 387 (your coordinate)
        }
      },
      
      // Pre-results page (4.png) - UPDATED WITH YOUR NEW COORDINATES
      preResults: {
        title: { x: 31, y: 109, width: 294, height: 280 }  // Your new coordinates
      },
      
      // Thank you page (6.png)
      thankyou: {
        title: { x: 42, y: 217, width: 275, height: 85 }
      }
    };

    function getPageLayout(pageType, bg) {
      if (pageType === "cover") return PAGE_LAYOUTS.cover;
      if (pageType === "intro" || pageType.startsWith("result")) return PAGE_LAYOUTS.intro_result;
      if (pageType === "question") return PAGE_LAYOUTS.question;
      if (pageType === "pre-results") return PAGE_LAYOUTS.preResults;
      if (pageType === "thankyou") return PAGE_LAYOUTS.thankyou;
      return PAGE_LAYOUTS.intro_result; // fallback
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
      const current = pageSequence[state.page];
      const pageType = current?.type;
      const currentBg = current?.bg || "";
      const layout = getPageLayout(pageType, currentBg);

      console.log("Rendering blocks for page type:", pageType, "blocks:", blocks);

      // --- Render ALL non-answer blocks using page-specific positioning ---
      blocks.forEach((block, idx) => {
        let type = (block.type || "").trim().toLowerCase();
        
        // Skip answer blocks - they get special treatment
        if (type === "answer") return;
        
        let style = "position:absolute;box-sizing:border-box;overflow:visible;";
        
        // Get positioning from page layout or use block's coordinates
        let position = null;
        
        if (pageType === "question" && type === "question") {
          position = layout.question;
        } else if ((pageType === "intro" || pageType.startsWith("result")) && type === "title") {
          position = layout.title;
        } else if ((pageType === "intro" || pageType.startsWith("result")) && (type === "description" || type === "desc")) {
          position = layout.description;
        } else if (pageType === "pre-results" && type === "title") {
          position = layout.title;
        } else if (pageType === "thankyou" && type === "title") {
          position = layout.title;
        }
        
        // Apply positioning - prefer layout coordinates, fallback to block coordinates
        if (position) {
          style += `left: ${(position.x * scaleX * shrinkFactor).toFixed(2)}px;`;
          style += `top: ${(position.y * scaleY * shrinkFactor).toFixed(2)}px;`;
          style += `width: ${(position.width * scaleX * shrinkFactor).toFixed(2)}px;`;
          style += `height: ${(position.height * scaleY * shrinkFactor).toFixed(2)}px;`;
        } else {
          // Fallback to block's own coordinates
          if (block.x !== undefined) style += `left: ${(block.x * scaleX * shrinkFactor).toFixed(2)}px;`;
          if (block.y !== undefined) style += `top: ${(block.y * scaleY * shrinkFactor).toFixed(2)}px;`;
          if (block.width !== undefined) style += `width: ${(block.width * scaleX * shrinkFactor).toFixed(2)}px;`;
          if (block.height !== undefined) style += `height: ${(block.height * scaleY * shrinkFactor).toFixed(2)}px;`;
        }

        // Text styling based on page type
        if (pageType === "pre-results" || pageType === "thankyou") {
          style += "text-align:center;"; // Center text for pre-results and thankyou
        } else {
          style += "text-align:left;"; // Left align for other pages
        }
        
        style += "display:flex;align-items:flex-start;justify-content:flex-start;";
        style += "white-space:pre-line;word-break:break-word;overflow-wrap:break-word;";
        
        // Apply block-specific styles
        if (block.fontSize) {
          const fontSize = typeof block.fontSize === "string" ? parseFloat(block.fontSize) : block.fontSize;
          style += `font-size: ${(fontSize * scaleY * shrinkFactor).toFixed(2)}px;`;
        }
        if (block.color) style += `color:${block.color};`;
        if (block.fontWeight) style += `font-weight:${block.fontWeight};`;
        if (block.lineHeight) style += `line-height:${block.lineHeight};`;
        if (block.margin !== undefined) style += `margin:${block.margin};`;
        if (block.padding !== undefined) style += `padding:${block.padding};`;

        // Add appropriate CSS class
        let className = "";
        if (type === "title") className = "block-title";
        else if (type === "description" || type === "desc") className = "block-desc";
        else if (type === "question") className = "block-question";
        else if (type === "result") className = "block-result";
        else className = "block-generic";

        console.log(`Rendering ${type} block at:`, position || 'custom coords', "Style:", style);
        html += `<div class="${className}" style="${style}">${block.text || ''}</div>`;
      });

      // --- Render answer buttons for Q&A page ---
      if (pageType === "question") {
        html += `<div id="dynamic-answer-buttons"></div>`;
      }

      return html;
    }

    // FIXED: Calculate question index more reliably
    function getCurrentQuestionIndex() {
      if (!quizConfig || !quizConfig.questionPages) {
        // Fallback: count question pages from beginning
        let questionCount = 0;
        for (let i = 0; i < state.page; i++) {
          if (pageSequence[i] && pageSequence[i].type === "question") {
            questionCount++;
          }
        }
        return questionCount;
      }

      // Find the question index based on current page
      const currentPageIndex = state.page;
      const questionPageIndex = quizConfig.questionPages.findIndex(q => q.idx === currentPageIndex);
      
      if (questionPageIndex !== -1) {
        return questionPageIndex;
      }
      
      // Fallback calculation
      let questionCount = 0;
      for (let i = 0; i < state.page; i++) {
        if (pageSequence[i] && pageSequence[i].type === "question") {
          questionCount++;
        }
      }
      return questionCount;
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
          // Calculate the result when user clicks "Get Results"
          if (quizConfig && quizConfig.calculateResultType) {
            SHOW_RESULT = quizConfig.calculateResultType();
            console.log("Calculated result type:", SHOW_RESULT, "from answers:", quizConfig.userAnswers);
          }
          
          // Navigate to the appropriate result page
          let resultPageIndex = -1;
          if (SHOW_RESULT === "A") resultPageIndex = pageSequence.findIndex(p => p.type === "resultA");
          else if (SHOW_RESULT === "B") resultPageIndex = pageSequence.findIndex(p => p.type === "resultB");
          else if (SHOW_RESULT === "C") resultPageIndex = pageSequence.findIndex(p => p.type === "resultC");
          else if (SHOW_RESULT === "D") resultPageIndex = pageSequence.findIndex(p => p.type === "resultD");
          
          if (resultPageIndex !== -1) {
            state.page = resultPageIndex;
          } else {
            // Fallback to first result page if specific result not found
            state.page = pageSequence.findIndex(p => p.type.startsWith("result"));
          }
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
              <button class="main-btn cover-btn-in-img" id="startBtn" style="position:absolute;bottom:50px;left:50%;transform:translateX(-50%);">${nextLabel}</button>
            </div>
          </div>
        `;
        setTimeout(() => {
          const startBtn = $("#startBtn");
          if (startBtn) {            
            startBtn.onclick = async () => {
              startBtn.disabled = true;
              startBtn.style.opacity = "0.6";
              startBtn.textContent = "Loading...";
              
              const quizUrlParam = getQuizUrlParam();
              console.log("Quiz URL parameter:", quizUrlParam);
              
              if (quizUrlParam) {
                state.isLoading = true;
                render(); // Show loading screen
                
                try {
                  const config = await fetchQuizFromRepoByQuizUrl(quizUrlParam);
                  console.log("Config returned:", config);

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
            ${current.type !== "thankyou" ? `<button class="main-btn" id="nextBtn">${nextLabel}</button>` : ""}
          </div>
        `;
        
        const img = $("#quiz-bg-img");
        const handleImageLoad = () => {
          const rect = img.getBoundingClientRect();
          const displayW = rect.width;
          const displayH = rect.height;

          const overlay = $("#block-overlay-layer");
          if (!overlay) {
            console.error("Block overlay layer not found");
            return;
          }
          
          overlay.style.width = displayW + "px";
          overlay.style.height = displayH + "px";
          overlay.style.left = "0px";
          overlay.style.top = "0px";

          const shrinkFactor = 0.97;
          overlay.innerHTML = renderBlocks(current.blocks || [], displayW / DESIGN_WIDTH, displayH / DESIGN_HEIGHT, shrinkFactor);

          // --- Dynamic Q&A answer button rendering ---
          if (current.type === "question") {
            let answerBlocks = (current.blocks || []).filter(b => (b.type || "").trim().toLowerCase() === "answer")
              .map(b => {
                let letter = "";
                // First check resultType
                if (typeof b.resultType === "string" && b.resultType.length === 1) {
                  letter = b.resultType.trim().toUpperCase();
                } else {
                  // Check for pattern like "A. Answer text"
                  let match = /^([A-D])\./.exec(b.text.trim());
                  if (match) {
                    letter = match[1];
                  } else {
                    // Fallback to first character
                    let firstLetter = b.text.trim().charAt(0).toUpperCase();
                    if (['A', 'B', 'C', 'D'].includes(firstLetter)) {
                      letter = firstLetter;
                    }
                  }
                }
                return { block: b, letter };
              })
              .sort((a, b) => a.letter.localeCompare(b.letter)); // Sort A, B, C, D

            // FIXED: Use the reliable question index calculation
            let questionIndex = getCurrentQuestionIndex();

            console.log("Answer blocks found:", answerBlocks);
            console.log("Current question index:", questionIndex);

            const answerLayer = overlay.querySelector("#dynamic-answer-buttons");
            if (answerLayer && answerBlocks.length > 0) {
              answerLayer.innerHTML = "";
              answerLayer.style.pointerEvents = "auto";

              const layout = getPageLayout("question");
              const shrinkFactor = 0.97;

              answerBlocks.forEach((answer, idx) => {
                // Get the fixed position for this answer using updated coordinates
                const answerPos = layout.answers[answer.letter];
                if (!answerPos) {
                  console.warn(`No position defined for answer ${answer.letter}`);
                  return;
                }

                let isSelected = false;
                if (quizConfig && quizConfig.userAnswers && questionIndex >= 0) {
                  isSelected = quizConfig.userAnswers[questionIndex] === answer.letter;
                }
                let btnColor = getAnswerColor(answer.letter);

                // Create button element
                let btn = document.createElement("button");
                btn.type = "button";
                btn.className = "block-answer-btn" + (isSelected ? " selected" : "");
                btn.setAttribute("data-answer", answer.letter);
                btn.setAttribute("data-question-index", questionIndex.toString());

                // Position using fixed coordinates from layout (your updated coordinates)
                btn.style.position = "absolute";
                btn.style.left = (answerPos.x * (displayW / DESIGN_WIDTH) * shrinkFactor) + "px";
                btn.style.top = (answerPos.y * (displayH / DESIGN_HEIGHT) * shrinkFactor) + "px";
                btn.style.width = (answerPos.width * (displayW / DESIGN_WIDTH) * shrinkFactor) + "px";
                btn.style.minHeight = (answerPos.height * (displayH / DESIGN_HEIGHT) * shrinkFactor) + "px";          

                // Button styling with improved spacing and appearance
                btn.style.background = btnColor;
                btn.style.border = "none";
                btn.style.borderRadius = Math.max(8, 12 * (displayH / DESIGN_HEIGHT) * shrinkFactor) + "px";
                btn.style.color = "#fff";
                btn.style.fontSize = Math.max(11, 14 * (displayH / DESIGN_HEIGHT) * shrinkFactor) + "px";
                btn.style.cursor = "pointer";
                btn.style.fontWeight = "600";
                btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
                btn.style.outline = "none";
                btn.style.zIndex = "10";
                
                // Layout - left align text in button with better spacing
                btn.style.display = "flex";
                btn.style.alignItems = "center";
                btn.style.justifyContent = "flex-start";
                btn.style.textAlign = "left";
                
                btn.style.opacity = isSelected ? "1.0" : "0.9";
                btn.style.transition = "all 0.2s ease";
                // Improved padding for better text spacing
                btn.style.padding = Math.max(8, 12 * (displayH / DESIGN_HEIGHT) * shrinkFactor) + "px";
                
                // Text handling for line wrapping with better spacing
                btn.style.whiteSpace = "pre-line";
                btn.style.wordBreak = "break-word";
                btn.style.overflowWrap = "break-word";
                btn.style.lineHeight = "1.3"; // Slightly increased for better readability

                // Set button text
                btn.innerHTML = answer.block.text || '';

                // Selection styling
                if (isSelected) {
                  btn.style.boxShadow = "0 0 0 2px #fff, 0 2px 12px rgba(0,0,0,0.2)";
                  btn.style.transform = "translateY(-1px)";
                }

                // Add hover effects
                btn.onmouseenter = () => {
                  if (!btn.classList.contains('selected')) {
                    btn.style.opacity = "1";
                    btn.style.transform = "translateY(-1px)";
                    btn.style.boxShadow = "0 2px 12px rgba(0,0,0,0.25)";
                  }
                };
                btn.onmouseleave = () => {
                  if (!btn.classList.contains('selected')) {
                    btn.style.opacity = "0.9";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
                  } else {
                    btn.style.transform = "translateY(-1px)";
                  }
                };

                answerLayer.appendChild(btn);
                
                console.log(`Button ${answer.letter} positioned at X:${answerPos.x} Y:${answerPos.y} W:${answerPos.width} H:${answerPos.height}`);
              });

              // Attach click listeners after all buttons are created
              setTimeout(() => {
                const answerBtns = answerLayer.querySelectorAll(".block-answer-btn");
                answerBtns.forEach(btn => {
                  btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    let answerLetter = btn.getAttribute("data-answer");
                    let questionIndex = parseInt(btn.getAttribute("data-question-index"));
                    
                    console.log(`Answer clicked: ${answerLetter} for question ${questionIndex}`);
                    
                    // FIXED: Validate question index before setting answer
                    if (questionIndex >= 0 && quizConfig && quizConfig.setAnswer) {
                      quizConfig.setAnswer(questionIndex, answerLetter);
                      console.log("Current answers:", quizConfig.userAnswers);
                    }
                    
                    // Update visual selection
                    answerBtns.forEach(b => {
                      b.classList.remove("selected");
                      b.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
                      b.style.opacity = "0.9";
                      b.style.transform = "translateY(0)";
                    });
                    
                    btn.classList.add("selected");
                    btn.style.boxShadow = "0 0 0 2px #fff, 0 2px 12px rgba(0,0,0,0.2)";
                    btn.style.opacity = "1.0";
                    btn.style.transform = "translateY(-1px)";
                  };
                });
              }, 20);
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
      
      // Mark body as app loaded for styling
      if (document.body) {
        document.body.classList.add('app-loaded');
      }
      
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
            
            console.log("Calculating results from answers:", this.userAnswers);
            
            this.userAnswers.forEach((ans, index) => {
              if (typeof ans === "string") {
                const val = ans.trim().toUpperCase();
                if (counts.hasOwnProperty(val)) {
                  counts[val]++;
                  console.log(`Answer ${index}: ${val} (running totals: A:${counts.A}, B:${counts.B}, C:${counts.C}, D:${counts.D})`);
                }
              }
            });
            
            console.log("Final counts:", counts);
            
            let max = Math.max(counts.A, counts.B, counts.C, counts.D);
            console.log("Highest score:", max);
            
            if (max === 0) {
              console.log("No answers found, defaulting to A");
              return "A";
            }
            
            let maxTypes = [];
            for (let type of ["A", "B", "C", "D"]) {
              if (counts[type] === max && max > 0) {
                maxTypes.push(type);
              }
            }
            
            console.log("Types with max score:", maxTypes);
            
            // Return first max type found
            for (let type of ["A", "B", "C", "D"]) {
              if (maxTypes.includes(type)) return type;
            }
            return "A";
          }
        };
      }
      
      // Ensure app container exists
      if (!ensureApp()) {
        console.log("App container not ready, waiting for DOM...");
        return;
      }
      
      console.log("App container ready, rendering initial state...");
      render();
    }

    // Handle window resize with debouncing
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!state.isLoading && !state.quizError) {
          render();
        }
      }, 100);
    });

    // Start the app
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      initializeApp();
    }
