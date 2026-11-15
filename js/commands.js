/**
 * MarkFlow — Sample Markdown Document & Slash (/) Command Definitions
 */

export const SAMPLE_MARKDOWN = `# Welcome to MarkFlow

A clean, distraction-free **Markdown file reader** and **Notion-style slash editor**. Type \`/\` anywhere on a new line or after a space in the editor to open the command menu!

> **Pro Tip:** Click any checkbox below directly in **Split** or **Reader** mode—it automatically updates the underlying Markdown source!

---

## Interactive Task Checklist

- [x] Read \`.md\` files with clean typography
- [x] Click this checkbox in the preview pane to toggle completion
- [ ] Type \`/\` in the editor to insert headings, tables, or code blocks
- [ ] Export your finished document as \`.md\` or standalone \`.html\`

---

## Supported Slash (\`/\`) Commands

Try typing \`/\` followed by any keyword to filter commands:

1. **Headings & Titles** — \`/h1\`, \`/h2\`, \`/h3\`, \`/h4\`
2. **Lists & Checkboxes** — \`/bullet\`, \`/number\`, \`/check\`
3. **Code & Tables** — \`/code\`, \`/inline\`, \`/table\`
4. **Callouts & Dividers** — \`/quote\`, \`/note\`, \`/divider\`
5. **Inline Formatting** — \`/bold\`, \`/italic\`, \`/strike\`, \`/link\`, \`/image\`

---

## Code Blocks & Syntax

\`\`\`javascript
// Example: Filtering slash commands in MarkFlow
function filterCommands(commands, query) {
  const normalized = query.toLowerCase().trim();
  return commands.filter(cmd =>
    cmd.title.toLowerCase().includes(normalized) ||
    cmd.keywords.some(k => k.includes(normalized))
  );
}
\`\`\`

---

## GitHub Flavored Tables

| Shortcut / Trigger | Action | Markdown Output |
| :--- | :--- | :--- |
| \`/\` + \`Enter\` | Open & insert slash block | Dynamic insertion |
| \`/h1\` – \`/h4\` | Insert section headings | \`# \` to \`#### \` |
| \`/check\` | Insert interactive task item | \`- [ ] \` |
| \`/table\` | Insert 3-column table | \`| Col | Col |\` |

---

## Links & Media

Check out the [Markdown Guide](https://www.markdownguide.org/) for full syntax reference, or embed images cleanly:

![Sample Banner](https://placehold.co/800x260/4f46e5/ffffff?text=MarkFlow+Markdown+Studio)
`;

export const SLASH_COMMANDS = [
  {
    id: 'h1',
    title: 'Document Title / Heading 1',
    subtitle: 'Large primary section heading (#)',
    icon: 'heading-1',
    badge: '#',
    keywords: ['title', 'h1', 'heading1', 'header'],
    action: () => ({ insert: '# ', cursorOffset: 0 })
  },
  {
    id: 'h2',
    title: 'Heading 2',
    subtitle: 'Medium section heading (##)',
    icon: 'heading-2',
    badge: '##',
    keywords: ['h2', 'heading2', 'subtitle', 'section'],
    action: () => ({ insert: '## ', cursorOffset: 0 })
  },
  {
    id: 'h3',
    title: 'Heading 3',
    subtitle: 'Small subsection heading (###)',
    icon: 'heading-3',
    badge: '###',
    keywords: ['h3', 'heading3', 'sub'],
    action: () => ({ insert: '### ', cursorOffset: 0 })
  },
  {
    id: 'h4',
    title: 'Heading 4',
    subtitle: 'Compact label heading (####)',
    icon: 'heading-4',
    badge: '####',
    keywords: ['h4', 'heading4'],
    action: () => ({ insert: '#### ', cursorOffset: 0 })
  },
  {
    id: 'paragraph',
    title: 'Paragraph',
    subtitle: 'Plain body text block',
    icon: 'pilcrow',
    badge: 'Text',
    keywords: ['p', 'paragraph', 'text', 'plain', 'body'],
    action: () => ({ insert: '', cursorOffset: 0 })
  },
  {
    id: 'checkbox',
    title: 'Task List / Checkbox',
    subtitle: 'Interactive to-do item (- [ ])',
    icon: 'check-square',
    badge: '- [ ]',
    keywords: ['check', 'checkbox', 'todo', 'task', 'list'],
    action: () => ({ insert: '- [ ] ', cursorOffset: 0 })
  },
  {
    id: 'bullet',
    title: 'Bullet List',
    subtitle: 'Unordered bulleted list (-)',
    icon: 'list',
    badge: '-',
    keywords: ['bullet', 'ul', 'unordered', 'list', 'points'],
    action: () => ({ insert: '- ', cursorOffset: 0 })
  },
  {
    id: 'number',
    title: 'Numbered List',
    subtitle: 'Ordered numbered list (1.)',
    icon: 'list-ordered',
    badge: '1.',
    keywords: ['number', 'numbered', 'ol', 'ordered', 'list'],
    action: () => ({ insert: '1. ', cursorOffset: 0 })
  },
  {
    id: 'quote',
    title: 'Blockquote',
    subtitle: 'Highlight a quote or excerpt (>)',
    icon: 'quote',
    badge: '>',
    keywords: ['quote', 'blockquote', 'citation'],
    action: () => ({ insert: '> ', cursorOffset: 0 })
  },
  {
    id: 'callout',
    title: 'Callout / Note',
    subtitle: 'Highlighted note callout block',
    icon: 'info',
    badge: 'Note',
    keywords: ['callout', 'note', 'info', 'alert', 'tip', 'warning'],
    action: () => ({ insert: '> **Note:** ', cursorOffset: 0 })
  },
  {
    id: 'codeblock',
    title: 'Code Block',
    subtitle: 'Fenced multi-line code snippet',
    icon: 'code-2',
    badge: '```',
    keywords: ['code', 'codeblock', 'pre', 'snippet', 'js', 'python'],
    action: () => ({
      insert: '```javascript\n// Write code here\n```',
      selectRange: [14, 33]
    })
  },
  {
    id: 'inlinecode',
    title: 'Inline Code',
    subtitle: 'Monospace inline code (`code`)',
    icon: 'terminal',
    badge: '` `',
    keywords: ['inline', 'code', 'mono', 'backtick'],
    action: () => ({
      insert: '`code`',
      selectRange: [1, 5]
    })
  },
  {
    id: 'table',
    title: 'Table',
    subtitle: 'Formatted 3-column Markdown table',
    icon: 'table',
    badge: '| |',
    keywords: ['table', 'grid', 'columns', 'rows', 'data'],
    action: () => ({
      insert: '| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |',
      selectRange: [2, 10]
    })
  },
  {
    id: 'divider',
    title: 'Divider / Horizontal Rule',
    subtitle: 'Visual section separator (---)',
    icon: 'minus',
    badge: '---',
    keywords: ['divider', 'hr', 'line', 'rule', 'separator'],
    action: () => ({ insert: '\n---\n\n', cursorOffset: 0 })
  },
  {
    id: 'link',
    title: 'Link',
    subtitle: 'Hyperlink with title and URL',
    icon: 'link',
    badge: '[]( )',
    keywords: ['link', 'url', 'href', 'anchor', 'website'],
    action: () => ({
      insert: '[Link text](https://example.com)',
      selectRange: [1, 10]
    })
  },
  {
    id: 'image',
    title: 'Image',
    subtitle: 'Embed image via URL (![alt](url))',
    icon: 'image',
    badge: '![]()',
    keywords: ['image', 'img', 'picture', 'photo', 'media'],
    action: () => ({
      insert: '![Alt description](https://placehold.co/800x400/6366f1/ffffff?text=Image)',
      selectRange: [2, 17]
    })
  },
  {
    id: 'bold',
    title: 'Bold Text',
    subtitle: 'Strong emphasis (**bold**)',
    icon: 'bold',
    badge: '**',
    keywords: ['bold', 'strong', 'heavy'],
    action: () => ({
      insert: '**bold text**',
      selectRange: [2, 11]
    })
  },
  {
    id: 'italic',
    title: 'Italic Text',
    subtitle: 'Italicized emphasis (*italic*)',
    icon: 'italic',
    badge: '*',
    keywords: ['italic', 'em', 'emphasis', 'slant'],
    action: () => ({
      insert: '*italic text*',
      selectRange: [1, 12]
    })
  },
  {
    id: 'strike',
    title: 'Strikethrough',
    subtitle: 'Crossed-out text (~~text~~)',
    icon: 'strikethrough',
    badge: '~~',
    keywords: ['strike', 'strikethrough', 'delete', 'cross'],
    action: () => ({
      insert: '~~strikethrough~~',
      selectRange: [2, 15]
    })
  }
];