import fs from 'fs';
import path from 'path';

const srcDir = path.join(import.meta.dirname, '..', 'src');

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(ent.name)) fixFile(p);
  }
}

function relImport(fromFile, toModule) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toModule).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function fixFile(file) {
  let s = fs.readFileSync(file, 'utf8');
  const original = s;

  // Alert: message= -> title= (prop only, not notification.message)
  s = s.replace(/\bmessage="/g, 'title="');

  // Space: direction -> orientation
  s = s.replace(/direction="vertical"/g, 'orientation="vertical"');
  s = s.replace(/direction="horizontal"/g, 'orientation="horizontal"');

  // Split message / Modal from antd imports -> utils/feedback
  s = s.replace(
    /^import\s+\{([^}]+)\}\s+from\s+'antd';/gm,
    (full, inner) => {
      const parts = inner.split(',').map((p) => p.trim()).filter(Boolean);
      const feedback = [];
      const antd = [];
      for (const part of parts) {
        const name = part.split(/\s+as\s+/)[0].trim();
        if (name === 'message' || name === 'Modal') feedback.push(part);
        else antd.push(part);
      }
      if (feedback.length === 0) return full;
      const feedbackPath = relImport(file, path.join(srcDir, 'utils', 'feedback'));
      const lines = [];
      if (antd.length) lines.push(`import { ${antd.join(', ')} } from 'antd';`);
      const fbNames = feedback.map((p) => p.split(/\s+as\s+/)[0].trim());
      lines.push(`import { ${fbNames.join(', ')} } from '${feedbackPath}';`);
      return lines.join('\n');
    },
  );

  if (s !== original) fs.writeFileSync(file, s);
}

walk(srcDir);
console.log('Ant Design deprecation fixes applied.');
