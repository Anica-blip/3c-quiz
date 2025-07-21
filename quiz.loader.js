async function fetchAndApplyQuizConfig() {
  const quizUrl = "https://anica-blip.github.io/3c-quiz/quiz-json/quiz.01.json";
  try {
    const res = await fetch(quizUrl);
    if (!res.ok) throw new Error("Quiz file not found");
    const data = await res.json();

    // --- TRANSFORM LOGIC ---
    // Example: mapping your quiz.01.json to QUIZ_CONFIG structure
    // (you must adjust this mapping to match your json format)
    const mapToQUIZ_CONFIG = (data) => {
      // 1. Intro pages
      const introPages = [
        {
          type: "cover",
          img: data.pages[0]?.bg || "static/1.png",
          btn: { label: "Enter", action: "next" }
        },
        {
          type: "info",
          bg: data.pages[1]?.bg || "static/2.png",
          btn: { label: "Start Quiz", action: "next" }
        }
      ];
      // 2. Questions
      const questions = (data.pages || [])
        .filter(p => p.type === "question")
        .map(p => ({
          bg: p.bg,
          question: p.blocks?.find(b => b.type === "title")?.text || "",
          answers: (p.blocks || [])
            .filter(b => b.type === "answer")
            .map(a => ({ text: a.text, result: a.result }))
        }));
      // 3. Results
      const resultPages = {};
      ["A", "B", "C"].forEach(letter => {
        resultPages[letter] = {
          bg: (data.pages.find(p => p.type === "result" + letter) || {}).bg || "static/4.png",
          resultText: "",
          btn: { label: "Finish", action: "thankYou" }
        };
      });
      // 4. Get Results & Thank You
      return {
        introPages,
        questions,
        getResults: {
          bg: data.pages.find(p => p.type === "pre-results")?.bg || "static/5.png",
          btn: { label: "Get Your Results", action: "showResult" }
        },
        resultPages,
        thankYou: {
          bg: data.pages.find(p => p.type === "thankyou")?.bg || "static/6.png"
        }
      };
    };

    // Replace the in-memory config
    window.QUIZ_CONFIG = mapToQUIZ_CONFIG(data);

    // Then continue to next page or rerender as needed
    // (e.g. state.page = 1; render();)
  } catch (e) {
    console.error("Failed to load/transform quiz JSON:", e);
    // fallback: use default QUIZ_CONFIG
  }
}
