/**
 * MarkFlow — Core Application Logic, Markdown Renderer & Slash Command Engine
 */

import { SAMPLE_MARKDOWN, SLASH_COMMANDS } from './commands.js';

// =========================================================================
// 1. APPLICATION STATE & DOM REFERENCES
// =========================================================================
const STORAGE_KEYS = {
  CONTENT: 'markflow_doc_content_v1',
  TITLE: 'markflow_doc_title_v1',
  MODE: 'markflow_view_mode_v1',
  THEME: 'markflow_theme_v1' // 'system' | 'light' | 'dark'
};

const state = {
  mode: 'split', // 'edit' | 'split' | 'preview'
  themePreference: 'system', // 'system' | 'light' | 'dark'
  slashOpen: false,
  slashStartIndex: -1,
  slashQuery: '',
  filteredCommands: [...SLASH_COMMANDS],
  selectedIndex: 0
};

// DOM Elements
const editor = document.getElementById('markdownEditor');
const preview = document.getElementById('markdownPreview');
const editorPane = document.getElementById('editorPane');
const previewPane = document.getElementById('previewPane');
const slashMenu = document.getElementById('slashMenu');
const slashMenuList = document.getElementById('slashMenuList');
const slashFilterBadge = document.getElementById('slashFilterBadge');
const caretMirror = document.getElementById('caretMirror');
const docTitleInput = document.getElementById('docTitleInput');
const fileInput = document.getElementById('fileInput');
const saveIndicator = document.getElementById('saveIndicator');

// =========================================================================
// 2. MARKDOWN CONFIGURATION & RENDERING
// =========================================================================
if (window.marked) {
  marked.setOptions({
    gfm: true,
    breaks: true
  });
}

/**
 * Renders raw Markdown from the editor into sanitized, interactive HTML
 */
function renderMarkdown() {
  const rawMarkdown = editor.value;

  if (!rawMarkdown.trim()) {
    preview.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center py-20 text-slate-400 dark:text-slate-600 select-none">
        <i data-lucide="file-text" class="w-12 h-12 mb-3 opacity-40"></i>
        <p class="text-base font-medium">This document is empty</p>
        <p class="text-xs mt-1">Switch to Edit or Split mode and type <code class="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800">/</code> to begin writing.</p>
      </div>
    `;
    lucide.createIcons({ root: preview });
    updateStats(rawMarkdown);
    return;
  }

  const rawHtml = marked.parse(rawMarkdown);
  const cleanHtml = window.DOMPurify
    ? DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['target', 'checked', 'disabled', 'type']
      })
    : rawHtml;

  preview.innerHTML = cleanHtml;

  // 1. Make task list checkboxes interactive & indexed
  const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((cb, idx) => {
    cb.removeAttribute('disabled');
    cb.classList.add('md-task-checkbox');
    cb.dataset.taskIndex = idx;

    const parentLi = cb.closest('li');
    if (parentLi && cb.checked) {
      parentLi.classList.add('task-checked');
    }

    cb.addEventListener('change', () => {
      toggleMarkdownCheckbox(idx, cb.checked);
    });
  });

  // 2. Wrap tables for responsive horizontal scrolling
  preview.querySelectorAll('table').forEach((table) => {
    if (!table.parentElement.classList.contains('table-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });

  // 3. Wrap <pre><code> blocks with language header & Copy button
  preview.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;
    const codeEl = pre.querySelector('code');
    let lang = 'code';
    if (codeEl && codeEl.className) {
      const match = codeEl.className.match(/language-([a-zA-Z0-9_-]+)/);
      if (match) lang = match[1];
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="uppercase tracking-wider text-[11px] font-semibold">${escapeHtml(lang)}</span>
      <button type="button" class="copy-code-btn flex items-center gap-1 text-[11px] hover:text-white transition-colors px-2 py-0.5 rounded bg-slate-700/60 hover:bg-slate-700">
        <span>Copy</span>
      </button>
    `;

    const copyBtn = header.querySelector('.copy-code-btn');
    copyBtn.addEventListener('click', () => {
      const textToCopy = codeEl ? codeEl.innerText : pre.innerText;
      copyTextToClipboard(textToCopy);
      copyBtn.innerHTML = '<span class="text-emerald-400">Copied!</span>';
      setTimeout(() => {
        copyBtn.innerHTML = '<span>Copy</span>';
      }, 1800);
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });

  // 4. Open external links safely in a new tab
  preview.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http://') || href.startsWith('https://')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  updateStats(rawMarkdown);
}

/**
 * Syncs a clicked checkbox in the preview pane back to the raw Markdown source
 */
function toggleMarkdownCheckbox(targetIndex, isChecked) {
  const lines = editor.value.split('\n');
  let taskCounter = 0;
  let inCodeFence = false;

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeFence = !inCodeFence;
      return line;
    }
    if (inCodeFence) return line;

    const taskRegex = /^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s*.*)$/;
    const match = line.match(taskRegex);
    if (match) {
      if (taskCounter === targetIndex) {
        taskCounter++;
        return `${match[1]}${isChecked ? 'x' : ' '}${match[3]}`;
      }
      taskCounter++;
    }
    return line;
  });

  editor.value = updatedLines.join('\n');
  saveToLocalStorage();
  renderMarkdown();
}

// =========================================================================
// 3. SLASH COMMAND (/) POPUP ENGINE & CARET POSITIONING
// =========================================================================

/**
 * Computes viewport (x, y) coordinates of a character index inside the textarea
 */
function getCaretCoordinates(textarea, position) {
  const rect = textarea.getBoundingClientRect();
  const style = window.getComputedStyle(textarea);

  caretMirror.style.width = `${rect.width}px`;
  caretMirror.style.paddingTop = style.paddingTop;
  caretMirror.style.paddingRight = style.paddingRight;
  caretMirror.style.paddingBottom = style.paddingBottom;
  caretMirror.style.paddingLeft = style.paddingLeft;
  caretMirror.style.font = style.font;
  caretMirror.style.lineHeight = style.lineHeight;
  caretMirror.style.letterSpacing = style.letterSpacing;

  const textBefore = textarea.value.substring(0, position);
  caretMirror.textContent = textBefore;

  const span = document.createElement('span');
  span.textContent = textarea.value.substring(position) || '.';
  caretMirror.appendChild(span);

  const spanOffsetTop = span.offsetTop - textarea.scrollTop;
  const spanOffsetLeft = span.offsetLeft - textarea.scrollLeft;
  const lineHeight = parseFloat(style.lineHeight) || 24;

  return {
    x: rect.left + spanOffsetLeft,
    y: rect.top + spanOffsetTop + lineHeight
  };
}

/**
 * Checks whether the cursor is currently typing a valid `/` command
 */
function evaluateSlashTrigger() {
  const cursorPos = editor.selectionStart;
  if (cursorPos !== editor.selectionEnd) {
    closeSlashMenu();
    return;
  }

  const textBeforeCursor = editor.value.substring(0, cursorPos);
  const lastSlashIdx = textBeforeCursor.lastIndexOf('/');

  if (lastSlashIdx === -1) {
    closeSlashMenu();
    return;
  }

  const charBeforeSlash = lastSlashIdx > 0 ? textBeforeCursor[lastSlashIdx - 1] : '\n';
  const isValidTriggerBoundary = charBeforeSlash === '\n' || charBeforeSlash === ' ' || charBeforeSlash === '\t';

  if (!isValidTriggerBoundary) {
    closeSlashMenu();
    return;
  }

  const query = textBeforeCursor.substring(lastSlashIdx + 1);
  if (/[\s\n]/.test(query)) {
    closeSlashMenu();
    return;
  }

  const normalizedQuery = query.toLowerCase();
  const matches = SLASH_COMMANDS.filter((cmd) => {
    if (!normalizedQuery) return true;
    return (
      cmd.title.toLowerCase().includes(normalizedQuery) ||
      cmd.id.toLowerCase().includes(normalizedQuery) ||
      cmd.keywords.some((kw) => kw.includes(normalizedQuery))
    );
  });

  if (matches.length === 0) {
    closeSlashMenu();
    return;
  }

  state.slashOpen = true;
  state.slashStartIndex = lastSlashIdx;
  state.slashQuery = query;
  state.filteredCommands = matches;
  state.selectedIndex = 0;

  renderSlashMenu();
  positionSlashMenu();
}

/**
 * Renders the filtered list of commands inside the floating slash menu
 */
function renderSlashMenu() {
  slashFilterBadge.textContent = state.slashQuery ? `/${state.slashQuery}` : 'all';

  slashMenuList.innerHTML = state.filteredCommands
    .map((cmd, idx) => {
      const isSelected = idx === state.selectedIndex;
      return `
        <button
          type="button"
          role="option"
          aria-selected="${isSelected}"
          data-cmd-index="${idx}"
          class="slash-item w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-3 transition-colors ${
            isSelected
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-200'
          }"
        >
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isSelected
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 dark:bg-slate-700/90 text-slate-600 dark:text-slate-300'
          }">
            <i data-lucide="${cmd.icon}" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold truncate">${escapeHtml(cmd.title)}</div>
            <div class="text-[11px] truncate ${
              isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-400'
            }">${escapeHtml(cmd.subtitle)}</div>
          </div>
          <span class="font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
            isSelected
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }">${escapeHtml(cmd.badge)}</span>
        </button>
      `;
    })
    .join('');

  lucide.createIcons({ root: slashMenuList });

  slashMenuList.querySelectorAll('.slash-item').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const idx = Number(btn.dataset.cmdIndex);
      executeSlashCommand(state.filteredCommands[idx]);
    });
    btn.addEventListener('mousemove', () => {
      const idx = Number(btn.dataset.cmdIndex);
      if (state.selectedIndex !== idx) {
        state.selectedIndex = idx;
        updateSlashSelectionHighlight();
      }
    });
  });
}

function updateSlashSelectionHighlight() {
  const items = slashMenuList.querySelectorAll('.slash-item');
  items.forEach((item, idx) => {
    const isSelected = idx === state.selectedIndex;
    item.setAttribute('aria-selected', isSelected);
    if (isSelected) {
      item.className = 'slash-item w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-3 transition-colors bg-indigo-600 text-white shadow-sm';
      item.querySelector('div:first-child').className = 'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/20 text-white';
      item.querySelector('div:nth-child(2) div:nth-child(2)').className = 'text-[11px] truncate text-indigo-100';
      item.querySelector('span').className = 'font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 bg-indigo-500 text-white';
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.className = 'slash-item w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-200';
      item.querySelector('div:first-child').className = 'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-700/90 text-slate-600 dark:text-slate-300';
      item.querySelector('div:nth-child(2) div:nth-child(2)').className = 'text-[11px] truncate text-slate-400 dark:text-slate-400';
      item.querySelector('span').className = 'font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
    }
  });
}

function positionSlashMenu() {
  slashMenu.classList.remove('hidden');
  const coords = getCaretCoordinates(editor, state.slashStartIndex);

  const menuRect = slashMenu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = coords.x;
  let top = coords.y + 4;

  if (left + menuRect.width > vw - 16) {
    left = Math.max(16, vw - menuRect.width - 16);
  }
  if (left < 16) left = 16;

  if (top + menuRect.height > vh - 40) {
    top = Math.max(60, coords.y - menuRect.height - 26);
  }

  slashMenu.style.left = `${left}px`;
  slashMenu.style.top = `${top}px`;
}

function closeSlashMenu() {
  if (!state.slashOpen) return;
  state.slashOpen = false;
  state.slashStartIndex = -1;
  state.slashQuery = '';
  slashMenu.classList.add('hidden');
}

function executeSlashCommand(command) {
  if (!command) return;
  const start = state.slashStartIndex >= 0 ? state.slashStartIndex : editor.selectionStart;
  const end = editor.selectionEnd;

  const result = command.action();
  const before = editor.value.substring(0, start);
  const after = editor.value.substring(end);

  editor.value = before + result.insert + after;
  editor.focus();

  if (result.selectRange) {
    editor.setSelectionRange(start + result.selectRange[0], start + result.selectRange[1]);
  } else {
    const newPos = start + result.insert.length + (result.cursorOffset || 0);
    editor.setSelectionRange(newPos, newPos);
  }

  closeSlashMenu();
  handleEditorInput();
}

// =========================================================================
// 4. EDITOR KEYBOARD & QUICK TOOLBAR HANDLERS
// =========================================================================
editor.addEventListener('input', () => {
  handleEditorInput();
  evaluateSlashTrigger();
});

editor.addEventListener('click', () => {
  evaluateSlashTrigger();
});

// Synchronized Scrolling between Editor & Preview in Split Mode
let activeScrollSource = null;
let scrollUnlockTimer = null;

function syncScrollPosition(sourceEl, targetEl) {
  if (state.mode !== 'split') return;
  const sourceMax = sourceEl.scrollHeight - sourceEl.clientHeight;
  const targetMax = targetEl.scrollHeight - targetEl.clientHeight;
  if (sourceMax <= 0 || targetMax <= 0) return;

  const scrollRatio = sourceEl.scrollTop / sourceMax;
  targetEl.scrollTop = scrollRatio * targetMax;
}

editor.addEventListener('scroll', () => {
  if (state.slashOpen) {
    positionSlashMenu();
  }

  if (activeScrollSource && activeScrollSource !== 'editor') return;
  activeScrollSource = 'editor';
  syncScrollPosition(editor, previewPane);

  clearTimeout(scrollUnlockTimer);
  scrollUnlockTimer = setTimeout(() => {
    activeScrollSource = null;
  }, 60);
});

previewPane.addEventListener('scroll', () => {
  if (activeScrollSource && activeScrollSource !== 'preview') return;
  activeScrollSource = 'preview';
  syncScrollPosition(previewPane, editor);

  clearTimeout(scrollUnlockTimer);
  scrollUnlockTimer = setTimeout(() => {
    activeScrollSource = null;
  }, 60);
});

editor.addEventListener('keydown', (e) => {
  if (state.slashOpen) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.selectedIndex = (state.selectedIndex + 1) % state.filteredCommands.length;
      updateSlashSelectionHighlight();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.selectedIndex =
        (state.selectedIndex - 1 + state.filteredCommands.length) % state.filteredCommands.length;
      updateSlashSelectionHighlight();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      executeSlashCommand(state.filteredCommands[state.selectedIndex]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSlashMenu();
      return;
    }
  }

  // Smart List Continuation on Enter
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const cursorPos = editor.selectionStart;
    if (cursorPos === editor.selectionEnd) {
      const textBefore = editor.value.substring(0, cursorPos);
      const lineStart = textBefore.lastIndexOf('\n') + 1;
      const currentLine = textBefore.substring(lineStart);

      const taskMatch = currentLine.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      if (taskMatch) {
        e.preventDefault();
        if (taskMatch[2].trim() === '') {
          replaceRange(lineStart, cursorPos, '');
        } else {
          const prefix = taskMatch[1].replace(/\[[xX]\]/, '[ ]');
          insertAtCursor(`\n${prefix}`);
        }
        return;
      }

      const bulletMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        if (bulletMatch[2].trim() === '') {
          replaceRange(lineStart, cursorPos, '');
        } else {
          insertAtCursor(`\n${bulletMatch[1]}`);
        }
        return;
      }

      const numMatch = currentLine.match(/^(\s*)(\d+)(\.\s+)(.*)$/);
      if (numMatch) {
        e.preventDefault();
        if (numMatch[4].trim() === '') {
          replaceRange(lineStart, cursorPos, '');
        } else {
          const nextNum = parseInt(numMatch[2], 10) + 1;
          insertAtCursor(`\n${numMatch[1]}${nextNum}${numMatch[3]}`);
        }
        return;
      }
    }
  }

  if (e.key === 'Tab' && !state.slashOpen) {
    e.preventDefault();
    insertAtCursor('  ');
  }
});

function insertAtCursor(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
  editor.setSelectionRange(start + text.length, start + text.length);
  handleEditorInput();
}

function replaceRange(start, end, replacement) {
  editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
  editor.setSelectionRange(start + replacement.length, start + replacement.length);
  handleEditorInput();
}

document.querySelectorAll('.quick-fmt-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const cmdId = btn.dataset.quick;
    const cmd = SLASH_COMMANDS.find((c) => c.id === cmdId);
    if (!cmd) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);

    if (selectedText && ['bold', 'italic', 'strike', 'inlinecode'].includes(cmdId)) {
      const wrappers = {
        bold: ['**', '**'],
        italic: ['*', '*'],
        strike: ['~~', '~~'],
        inlinecode: ['`', '`']
      };
      const [openW, closeW] = wrappers[cmdId];
      const wrapped = `${openW}${selectedText}${closeW}`;
      editor.value = editor.value.substring(0, start) + wrapped + editor.value.substring(end);
      editor.focus();
      editor.setSelectionRange(start + openW.length, start + openW.length + selectedText.length);
      handleEditorInput();
      return;
    }

    state.slashStartIndex = start;
    executeSlashCommand(cmd);
  });
});

document.getElementById('triggerSlashHintBtn').addEventListener('click', () => {
  editor.focus();
  const pos = editor.selectionStart;
  const charBefore = pos > 0 ? editor.value[pos - 1] : '\n';
  const needsSpace = charBefore !== '\n' && charBefore !== ' ' && charBefore !== '\t';
  insertAtCursor(needsSpace ? ' /' : '/');
  evaluateSlashTrigger();
});

// =========================================================================
// 5. VIEW MODES, THEME, FILE I/O & PERSISTENCE
// =========================================================================
function setViewMode(mode) {
  state.mode = mode;
  localStorage.setItem(STORAGE_KEYS.MODE, mode);

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    if (isActive) {
      btn.className =
        'mode-btn flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs transition-all';
    } else {
      btn.className =
        'mode-btn flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all';
    }
  });

  const workspace = document.getElementById('workspace');
  if (mode === 'edit') {
    editorPane.classList.remove('hidden');
    previewPane.classList.add('hidden');
    workspace.classList.remove('flex-col', 'md:flex-row');
    editor.focus();
  } else if (mode === 'preview') {
    editorPane.classList.add('hidden');
    previewPane.classList.remove('hidden');
    workspace.classList.remove('flex-col', 'md:flex-row');
    closeSlashMenu();
    renderMarkdown();
  } else {
    editorPane.classList.remove('hidden');
    previewPane.classList.remove('hidden');
    workspace.classList.add('flex-col', 'md:flex-row');
    renderMarkdown();
  }
}

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
});

const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function resolveEffectiveTheme(preference) {
  if (preference === 'system') {
    return systemDarkQuery.matches ? 'dark' : 'light';
  }
  return preference;
}

function updateThemeButtonUI(preference, effectiveTheme) {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;

  if (preference === 'system') {
    btn.innerHTML = `<i data-lucide="monitor" class="w-4 h-4 text-indigo-500 dark:text-indigo-400"></i>`;
    btn.title = `Theme: Auto (${effectiveTheme === 'dark' ? 'Dark' : 'Light'}) — Click to switch to Light`;
  } else if (preference === 'light') {
    btn.innerHTML = `<i data-lucide="sun" class="w-4 h-4 text-amber-500"></i>`;
    btn.title = 'Theme: Light — Click to switch to Dark';
  } else {
    btn.innerHTML = `<i data-lucide="moon" class="w-4 h-4 text-indigo-400"></i>`;
    btn.title = 'Theme: Dark — Click to switch to Auto (System)';
  }
  lucide.createIcons({ root: btn });
}

function applyTheme(preference = 'system', save = true) {
  state.themePreference = preference;
  const effectiveTheme = resolveEffectiveTheme(preference);
  const html = document.documentElement;

  if (effectiveTheme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
  }

  if (save) {
    localStorage.setItem(STORAGE_KEYS.THEME, preference);
  }
  updateThemeButtonUI(preference, effectiveTheme);
}

// Listen for OS / Browser theme changes in real time when in 'system' mode
systemDarkQuery.addEventListener('change', () => {
  if (state.themePreference === 'system') {
    applyTheme('system', false);
  }
});

// Cycle: Auto (System) -> Light -> Dark -> Auto (System)
document.getElementById('themeToggleBtn').addEventListener('click', () => {
  const nextMap = {
    system: 'light',
    light: 'dark',
    dark: 'system'
  };
  const nextPref = nextMap[state.themePreference] || 'system';
  applyTheme(nextPref, true);

  const labelMap = {
    system: `Theme: Auto (${resolveEffectiveTheme('system') === 'dark' ? 'Dark' : 'Light'})`,
    light: 'Theme: Light',
    dark: 'Theme: Dark'
  };
  showToast(labelMap[nextPref]);
});

let saveTimeout = null;
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.CONTENT, editor.value);
    localStorage.setItem(STORAGE_KEYS.TITLE, docTitleInput.value);
    saveIndicator.classList.remove('opacity-50');
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
  }
}

function handleEditorInput() {
  renderMarkdown();
  saveIndicator.classList.add('opacity-50');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveToLocalStorage, 250);
}

docTitleInput.addEventListener('input', () => {
  saveToLocalStorage();
});

function updateStats(text) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const minutes = Math.max(1, Math.ceil(words / 200));

  document.getElementById('wordCount').textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  document.getElementById('charCount').textContent = `${chars.toLocaleString()} chars`;
  document.getElementById('readTime').textContent = words === 0 ? '0 min read' : `${minutes} min read`;

  const totalTasks = (text.match(/^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]/gm) || []).length;
  const doneTasks = (text.match(/^\s*(?:[-*+]|\d+\.)\s+\[[xX]\]/gm) || []).length;
  const taskStatsEl = document.getElementById('taskStats');
  if (totalTasks > 0) {
    taskStatsEl.textContent = `Tasks: ${doneTasks}/${totalTasks}`;
  } else {
    taskStatsEl.textContent = '';
  }
}

// New Document Modal
const modalOverlay = document.getElementById('modalOverlay');
document.getElementById('newFileBtn').addEventListener('click', () => {
  if (!editor.value.trim()) {
    docTitleInput.value = 'untitled.md';
    editor.focus();
    return;
  }
  modalOverlay.classList.remove('hidden');
});

document.getElementById('modalCancelBtn').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

document.getElementById('modalConfirmBtn').addEventListener('click', () => {
  editor.value = '# Untitled Document\n\n';
  docTitleInput.value = 'untitled.md';
  modalOverlay.classList.add('hidden');
  handleEditorInput();
  if (state.mode === 'preview') setViewMode('split');
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
  showToast('Created new Markdown file');
});

document.getElementById('loadSampleBtn').addEventListener('click', () => {
  editor.value = SAMPLE_MARKDOWN;
  docTitleInput.value = 'welcome-guide.md';
  handleEditorInput();
  showToast('Loaded sample Markdown guide');
});

// Open Local .md File
document.getElementById('openFileBtn').addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    editor.value = event.target.result;
    docTitleInput.value = file.name;
    handleEditorInput();
    showToast(`Opened "${file.name}"`);
  };
  reader.onerror = () => {
    showToast('Failed to read file');
  };
  reader.readAsText(file);
  fileInput.value = '';
});

// Drag & Drop .md file support
window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type.startsWith('text/'))) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      editor.value = ev.target.result;
      docTitleInput.value = file.name;
      handleEditorInput();
      showToast(`Imported "${file.name}"`);
    };
    reader.readAsText(file);
  }
});

// Copy Markdown
function copyTextToClipboard(text) {
  const tempArea = document.createElement('textarea');
  tempArea.value = text;
  tempArea.style.position = 'fixed';
  tempArea.style.opacity = '0';
  document.body.appendChild(tempArea);
  tempArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Copy failed:', err);
  }
  document.body.removeChild(tempArea);
}

document.getElementById('copyMdBtn').addEventListener('click', () => {
  copyTextToClipboard(editor.value);
  showToast('Markdown copied to clipboard');
});

// Export Dropdown & Downloads
const exportMenuBtn = document.getElementById('exportMenuBtn');
const exportDropdown = document.getElementById('exportDropdown');

exportMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!document.getElementById('exportDropdownContainer').contains(e.target)) {
    exportDropdown.classList.add('hidden');
  }
  if (!slashMenu.contains(e.target) && e.target !== editor) {
    closeSlashMenu();
  }
});

document.getElementById('downloadMdBtn').addEventListener('click', () => {
  exportDropdown.classList.add('hidden');
  let filename = docTitleInput.value.trim() || 'document.md';
  if (!filename.endsWith('.md') && !filename.endsWith('.markdown')) {
    filename += '.md';
  }
  triggerDownload(filename, editor.value, 'text/markdown;charset=utf-8');
  showToast(`Downloaded ${filename}`);
});

document.getElementById('downloadHtmlBtn').addEventListener('click', () => {
  exportDropdown.classList.add('hidden');
  const baseName = (docTitleInput.value.trim() || 'document').replace(/\.(md|markdown|txt)$/i, '');
  const filename = `${baseName}.html`;

  const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      line-height: 1.7;
      color: #1e293b;
      max-width: 780px;
      margin: 2.5rem auto;
      padding: 0 1.5rem;
    }
    h1, h2, h3, h4 { color: #0f172a; margin-top: 1.75rem; }
    h1 { border-bottom: 1px solid #e2e8f0; padding-bottom: 0.4rem; }
    h2 { border-bottom: 1px solid #f1f5f9; padding-bottom: 0.3rem; }
    a { color: #4f46e5; }
    blockquote {
      border-left: 4px solid #6366f1;
      background: #f8fafc;
      padding: 0.75rem 1rem;
      margin: 1rem 0;
      border-radius: 0 8px 8px 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #f1f5f9;
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 1rem;
      border-radius: 10px;
      overflow-x: auto;
    }
    pre code { background: transparent; color: inherit; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; }
    th, td { border: 1px solid #cbd5e1; padding: 0.6rem 0.85rem; text-align: left; }
    th { background: #f1f5f9; }
    img { max-width: 100%; border-radius: 8px; }
    hr { border: 0; height: 1px; background: #e2e8f0; margin: 2rem 0; }
  </style>
</head>
<body>
${marked.parse(editor.value)}
</body>
</html>`;

  triggerDownload(filename, standaloneHtml, 'text/html;charset=utf-8');
  showToast(`Exported ${filename}`);
});

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className =
    'px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium shadow-lg border border-slate-700/80 flex items-center gap-2 transition-all duration-200 slash-menu-animate';
  toast.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =========================================================================
// 6. INITIALIZATION
// =========================================================================
function initApp() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
    applyTheme(savedTheme, false);
  } else {
    applyTheme('system', false);
  }

  const savedContent = localStorage.getItem(STORAGE_KEYS.CONTENT);
  const savedTitle = localStorage.getItem(STORAGE_KEYS.TITLE);

  if (savedContent !== null) {
    editor.value = savedContent;
    docTitleInput.value = savedTitle || 'document.md';
  } else {
    editor.value = SAMPLE_MARKDOWN;
    docTitleInput.value = 'welcome-guide.md';
  }

  const savedMode = localStorage.getItem(STORAGE_KEYS.MODE);
  if (savedMode) {
    setViewMode(savedMode);
  } else {
    setViewMode(window.innerWidth < 768 ? 'edit' : 'split');
  }

  renderMarkdown();
  lucide.createIcons();
}

window.addEventListener('DOMContentLoaded', initApp);