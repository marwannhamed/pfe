import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function themePageFile(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');

  const depth = filePath.split(/[/\\]pages[/\\]/)[1]?.split(/[/\\]/).length - 1 ?? 2;
  const rel = '../'.repeat(depth) + 'hooks/usePageTheme';
  const importLine = `import { usePageTheme } from '${rel}';\n`;

  if (!c.includes('usePageTheme')) {
    const m = c.match(/^import .+;\n/m);
    if (m) c = c.replace(m[0], m[0] + importLine);
    else c = importLine + c;
  }

  c = c.replace(/const CARD(?:: React\.CSSProperties)?\s*=\s*\{[\s\S]*?\};\s*\n/g, '');
  c = c.replace(/const INPUT(?:: React\.CSSProperties)?\s*=\s*\{[\s\S]*?\};\s*\n/g, '');
  c = c.replace(/const LABEL(?:: React\.CSSProperties)?\s*=\s*\{[\s\S]*?\};\s*\n/g, '');

  c = c.replace(
    /((?:export default )?function ([A-Z][A-Za-z0-9]*)\([^)]*\) \{)\n/g,
    (open, _full, name) => {
      const hook =
        name === 'Field'
          ? '  const { input: INPUT, t: th } = usePageTheme();\n  const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textSub, display: \'block\', marginBottom: 5 };\n'
          : '  const { card: CARD, input: INPUT, t: th } = usePageTheme();\n';
      return `${open}\n${hook}`;
    },
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
    ["borderBottom: '1px solid #f1f5f9'", 'borderBottom: `1px solid ${th.divider}`'],
    ["borderTop: '1px solid #f1f5f9'", 'borderTop: `1px solid ${th.divider}`'],
  ];
  for (const [from, to] of reps) c = c.split(from).join(to);

  fs.writeFileSync(filePath, c);
  console.log('themed', path.relative(root, filePath));
}

for (const t of process.argv.slice(2)) {
  themePageFile(path.resolve(t));
}
