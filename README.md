# MarkFlow — Markdown Reader & Slash Editor

A clean, distraction-free **Markdown (`.md`) file reader and Notion-style slash-command editor** built with vanilla HTML, CSS, Tailwind CSS, and modular JavaScript.

## ✨ Features

- **Slash (`/`) Command Palette**: Type `/` at the start of a line or after whitespace to insert headings (`#`–`####`), paragraphs, interactive checkboxes (`- [ ]`), bullet/numbered lists, blockquotes, callouts, fenced code blocks, inline code, tables, dividers, links, images, and inline formatting.
- **Three Workspace Modes**: Switch seamlessly between **Edit**, **Split-Screen** (live side-by-side editor and rendered preview), and **Reader** mode.
- **Interactive Task Checkboxes**: Click task list checkboxes directly in the rendered preview to automatically sync `- [ ]` / `- [x]` back to your Markdown source.
- **File Management & Export**: Open or drag-and-drop local `.md` files, auto-save drafts to `localStorage`, copy raw Markdown, or export to `.md` and standalone `.html`.
- **Light & Dark Themes**: Automatic system theme detection with a manual toggle.

## 📁 Repository Structure

```text
markflow/
├── index.html          # Main application HTML shell & layout
├── css/
│   └── styles.css      # Custom typography, rendered Markdown, checkbox & table styles
├── js/
│   ├── commands.js     # Sample Markdown content & slash (/) command definitions
│   └── app.js          # Core editor logic, caret coordinate mirror, parser & file I/O
└── README.md           # Project documentation
```

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pareshbagada13/MarkFlow.git
   cd markflow
   ```

2. **Run locally:**
   Because `js/app.js` uses standard ES modules (`type="module"`), serve the folder with any static HTTP server:
   ```bash
   # Using Python 3
   python -m http.server 8080

   # Or using Node.js (npx)
   npx serve .
   ```

3. Open `http://localhost:8080` in your browser.

## 📄 License

MIT License — feel free to use, modify, and distribute.