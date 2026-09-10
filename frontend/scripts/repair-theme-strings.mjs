import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pagesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages');

function repair(content) {
  let c = content;
  c = c.replace(/#0f172a'Muted/g, "'#94a3b8'");
  c = c.replace(/#0f172a'Sub/g, "'#64748b'");
  c = c.replace(/\$\{'#e5e7eb'\}/g, '${theme.cardBorder}');
  c = c.replace(/border: `\$\{'#e5e7eb'\}`/g, 'border: `1px solid ${theme.cardBorder}`');
  c = c.replace(/border: `1px solid \$\{'#e5e7eb'\}`/g, 'border: `1px solid ${theme.cardBorder}`');
  c = c.replace(/background: '#fff'Bg/g, 'background: theme.cardBg');
  return c;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.tsx')) {
      const c = fs.readFileSync(p, 'utf8');
      const fixed = repair(c);
      if (fixed !== c) {
        fs.writeFileSync(p, fixed);
        console.log('repaired', path.relative(pagesDir, p));
      }
    }
  }
}

walk(pagesDir);
