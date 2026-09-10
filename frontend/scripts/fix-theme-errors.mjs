import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pagesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages');

const STATIC = {
  'theme.text': "'#0f172a'",
  'theme.textSub': "'#64748b'",
  'theme.textMuted': "'#94a3b8'",
  'theme.cardBg': "'#fff'",
  'theme.cardBorder': "'#e5e7eb'",
  'theme.tableHead': "'#f8fafc'",
  'theme.divider': "'#f1f5f9'",
  'theme.hover': "'#fafafa'",
  'theme.inputBorder': "'#e5e7eb'",
  'theme.inputBg': "'#fff'",
};

function fixFile(filePath) {
  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let exportLine = lines.findIndex((l) => l.includes('export default function'));
  if (exportLine < 0) return;

  // Module-level constants: revert theme.* to static light tokens
  for (let i = 0; i < exportLine; i++) {
    for (const [from, to] of Object.entries(STATIC)) {
      lines[i] = lines[i].split(from).join(to);
    }
  }

  let content = lines.join('\n');

  // Add usePageTheme to inner function components that reference theme
  content = content.replace(
    /function (\w+)\(([^)]*)\) \{\n/g,
    (match, name, params) => {
      if (name === 'default') return match;
      return match;
    },
  );

  const fnRegex = /function (\w+)\([^)]*\) \{/g;
  let m;
  const inserts = [];
  while ((m = fnRegex.exec(content)) !== null) {
    const start = m.index + m[0].length;
    const fnName = m[1];
    if (fnName === 'default') continue;
    const slice = content.slice(start, start + 4000);
    if (!slice.includes('theme.') || slice.slice(0, 200).includes('usePageTheme')) continue;
    inserts.push({ index: start, fnName });
  }

  // Insert from end to preserve indices
  for (let i = inserts.length - 1; i >= 0; i--) {
    const { index, fnName } = inserts[i];
    const hook = `  const { t: theme } = usePageTheme();\n`;
    content = content.slice(0, index) + hook + content.slice(index);
  }

  if (!content.includes("import { usePageTheme }") && content.includes('usePageTheme()')) {
    content = content.replace(
      /^import .+;\n/m,
      (line) => line + "import { usePageTheme } from '../../hooks/usePageTheme';\n",
    );
  }

  fs.writeFileSync(filePath, content);
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.tsx')) fixFile(p);
  }
}

walk(pagesDir);
console.log('done');
