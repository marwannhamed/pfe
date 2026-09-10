import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pagesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages');

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      const next = c.replace(/padding: 24, background: '#f8fafc', minHeight: '100%'/g, "padding: 24, minHeight: '100%'");
      if (next !== c) {
        fs.writeFileSync(p, next);
        console.log(path.relative(pagesDir, p));
      }
    }
  }
}

walk(pagesDir);
