const QUIZ_CONFIG = {
  introPages: [
    {
      type: "cover",
      img: "static/1.png",
      btn: { label: "Enter", action: "next" }
    },
    {
      type: "info",
      bg: "static/4.png", // <- changed from 2.png to 4.png
      btn: { label: "Start Quiz", action: "next" }
    }
  ],
  questions: [
    {
      bg: "static/3.png",
      question: "Which best describes your approach?",
      answers: [
        { text: "Analytical", result: "A" },
        { text: "Bold", result: "B" },
        { text: "Creative", result: "C" }
      ]
    },
    {
      bg: "static/3.png",
      question: "What motivates you most?",
      answers: [
        { text: "Achievement", result: "A" },
        { text: "Adventure", result: "B" },
        { text: "Collaboration", result: "C" }
      ]
    }
  ],
  getResults: {
    bg: "static/5.png", // <- now uses 5.png as background
    btn: { label: "Get Your Results", action: "showResult" }
  },
  resultPages: {
    "A": {
      bg: "static/4.png", // result page uses 4.png, no extra text
      resultText: "", // no text, just button
      btn: { label: "Finish", action: "thankYou" }
    },
    "B": {
      bg: "static/4.png",
      resultText: "",
      btn: { label: "Finish", action: "thankYou" }
    },
    "C": {
      bg: "static/4.png",
      resultText: "",
      btn: { label: "Finish", action: "thankYou" }
    }
  },
  thankYou: {
    bg: "static/6.png"
  }
};
