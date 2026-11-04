import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(tsx?|json|css|html|md|mjs|ya?ml)$/.test(path) ? [path] : [];
  });
}
const broken = new RegExp('[\\u00c3\\u00c2\\ufffd]');
const errors = sourceFiles(process.cwd()).filter(path => broken.test(readFileSync(path, 'utf8')));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('UTF-8: sin mojibake.');
