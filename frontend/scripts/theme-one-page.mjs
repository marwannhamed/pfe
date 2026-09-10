import fs from 'fs';

/** Apply usePageTheme to a list page (main export + color tokens). */
export function themeListPage(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes('const { card: CARD, t: th } = usePageTheme()')) return;

  if (!c.includes('usePageTheme')) {
    c = c.replace(/^import .+;\n/m, (m) => m + "import { usePageTheme } from '../../hooks/usePageTheme';\n");
  }

  c = c.replace(
    /const CARD: React\.CSSProperties = \{[\s\S]*?\};\n\n/g,
    '',
  );

  c = c.replace(
    /export default function (\w+)\(\) \{\n/,
    'export default function $1() {\n  const { card: CARD, t: th } = usePageTheme();\n',
  );

  const reps = [
    ["color: '#0f172a'", 'color: th.text'],
    ["color: '#64748b'", 'color: th.textSub'],
    ["color: '#94a3b8'", 'color: th.textMuted'],
    ["color: '#374151'", 'color: th.text'],
    ["background: '#f8fafc'", 'background: th.tableHead'],
    ["'1px solid #f8fafc'", '`1px solid ${th.divider}`'],
    ["border: '1px solid #e5e7eb'", 'border: `1px solid ${th.cardBorder}`'],
    ["'1px solid #e5e7eb'", '`1px solid ${th.cardBorder}`'],
    ["background: '#fff'", 'background: th.cardBg'],
    ["e.currentTarget.style.background = '#fafafa'", 'e.currentTarget.style.background = th.hover'],
    ["borderBottom: '1px solid #e5e7eb'", 'borderBottom: `1px solid ${th.cardBorder}`'],
  ];

  for (const [from, to] of reps) {
    c = c.split(from).join(to);
  }

  fs.writeFileSync(filePath, c);
  console.log('themed', filePath);
}
