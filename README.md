# 3c-quiz

A customizable quiz application with dynamic backgrounds and navigation, structured for easy integration with an admin/editor app for quiz text management.

## File Structure

- `index.html` – Main HTML entry.
- `quiz-config.js` – Quiz configuration (to be dynamically updated in the future).
- `quiz.app.js` – Main JavaScript logic for quiz rendering and navigation.
- `style.css` – Styles for containers, overlays, and buttons.
- `static/` – All static assets (background images, navigation buttons, etc.)

## Background Images

- `1.png`  – Cover background image
- `2.png`  – Quiz intro/title/description background
- `3a.png` to `3h.png` – Question backgrounds (max 8)
- `4.png`  – Pre-results description background
- `5a.png` to `5d.png` – Results backgrounds (A/B/C/D)
- `6.png`  – Thank you/exit background

## Navigating Buttons

All navigation buttons are stored in `/static`.

## Quiz Flow

1. **Cover Page**: 1.png
2. **Intro/Description**: 2.png
3. **Questions**: 3a.png, 3b.png, ..., 3h.png (up to 8)
   - Each page supports 3 or 4 answers.
4. **Pre-Result Description**: 4.png
5. **Results**:
   - 5a.png – Result A
   - 5b.png – Result B
   - 5c.png – Result C
   - 5d.png – Result D
6. **Thank You**: 6.png

## Next Steps

- Refactor `quiz.app.js` to remove legacy Q&A buttons and ensure all navigation is via bottom buttons.
- Prepare for admin/editor app (to manage quiz text).

---

*This project is the template/operational version of the quiz app. All quiz content will eventually be managed via a separate admin/editor app for easy editing and updating.*
