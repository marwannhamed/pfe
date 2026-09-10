import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pagesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages');

const SKIP = new Set([
  'ProfilePage.tsx',
  'LoginPage.tsx',
  'RegisterPage.tsx',
  'ForgotPasswordPage.tsx',
  'ResetPasswordPage.tsx',
]);

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.tsx')) processFile(p);
  }
}

function processFile(filePath) {
  const base = path.basename(filePath);
  if (SKIP.has(base)) return;

  let c = fs.readFileSync(filePath, 'utf8');
  const original = c;

  c = c.replace(/padding: 24, background: '#f8fafc', minHeight: '100%'/g, "padding: 24, minHeight: '100%'");

  const cardRe = /const CARD(?:: React\.CSSProperties)?\s*=\s*\{[\s\S]*?\};\s*\n/g;
  const hasModuleCard = /const CARD(?:: React\.CSSProperties)?\s*=/.test(c);
  const alreadyThemed =
    c.includes('usePageTheme()') ||
    (c.includes('useThemeStore') && c.includes('const CARD: React.CSSProperties = {\n    background: t.'));

  if (hasModuleCard && !alreadyThemed) {
    c = c.replace(cardRe, '');

    if (!c.includes('usePageTheme')) {
      const hookImport = "import { usePageTheme } from '../../hooks/usePageTheme';\n";
      const m = c.match(/^import .+;\n/m);
      if (m) c = c.replace(m[0], m[0] + hookImport);
      else c = hookImport + c;
    }

    if (!c.includes('usePageTheme()')) {
      c = c.replace(
        /export default function (\w+)\(\) \{\n/,
        "export default function $1() {\n  const { card: CARD, t: theme, page, tableHead, btnSecondary } = usePageTheme();\n",
      );
    }

    c = c.replace(/color: '#0f172a'/g, 'color: theme.text');
    c = c.replace(/color: '#64748b'/g, 'color: theme.textSub');
    c = c.replace(/color: '#94a3b8'/g, 'color: theme.textMuted');
    c = c.replace(/color: '#374151'/g, 'color: theme.text');
    c = c.replace(/background: '#f8fafc'/g, 'background: theme.tableHead');
    c = c.replace(/'1px solid #f8fafc'/g, '`1px solid ${theme.divider}`');
    c = c.replace(/'1px solid #e5e7eb'/g, '`1px solid ${theme.cardBorder}`');
    c = c.replace(/border: '1px solid #e5e7eb'/g, 'border: `1px solid ${theme.cardBorder}`');
    c = c.replace(/background: '#fff'/g, 'background: theme.cardBg');
    c = c.replace(/e\.currentTarget\.style\.background = '#fafafa'/g, 'e.currentTarget.style.background = theme.hover');
    c = c.replace(/<strong style=\{\{ color: '#0f172a' \}\}/g, '<strong style={{ color: theme.text }}');
    c = c.replace(/prefix=\{<SearchOutlined style=\{\{ color: '#94a3b8' \}\}/g, 'prefix={<SearchOutlined style={{ color: theme.textMuted }}');
  }

  if (c !== original) {
    fs.writeFileSync(filePath, c);
    console.log('updated', path.relative(pagesDir, filePath));
  }
}

walk(pagesDir);
