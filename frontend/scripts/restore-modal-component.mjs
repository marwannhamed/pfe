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

function fixFile(file) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes("utils/feedback") || !s.includes('Modal')) return;

  const original = s;

  // import { Modal, message } from feedback -> message only from feedback, Modal from antd
  s = s.replace(
    /import\s+\{\s*Modal,\s*message\s*\}\s+from\s+['"][^'"]+utils\/feedback['"];\n?/g,
    "import { message } from '../../utils/feedback';\n".replace('../../utils/feedback', relativeFeedback(file)),
  );
  s = s.replace(
    /import\s+\{\s*message,\s*Modal\s*\}\s+from\s+['"][^'"]+utils\/feedback['"];\n?/g,
    "import { message } from '../../utils/feedback';\n".replace('../../utils/feedback', relativeFeedback(file)),
  );
  s = s.replace(
    /import\s+\{\s*Modal\s*\}\s+from\s+['"][^'"]+utils\/feedback['"];\n?/g,
    '',
  );

  if (s.includes('<Modal') || s.includes('Modal.confirm') || s.includes('Modal.info')) {
    const antdImport = s.match(/^import\s+\{([^}]+)\}\s+from\s+'antd';/m);
    if (antdImport) {
      if (!antdImport[1].includes('Modal')) {
        s = s.replace(/^import\s+\{([^}]+)\}\s+from\s+'antd';/m, (line, inner) =>
          `import { ${inner.trim()}, Modal } from 'antd';`,
        );
      }
    } else {
      // insert antd Modal import after first import
      s = s.replace(/^(import .+\n)/, "$1import { Modal } from 'antd';\n");
    }
  }

  if (s !== original) fs.writeFileSync(file, s);
}

function relativeFeedback(file) {
  const fromDir = path.dirname(file);
  let rel = path.relative(fromDir, path.join(srcDir, 'utils', 'feedback')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

walk(srcDir);
console.log('Modal component imports restored on antd.');
