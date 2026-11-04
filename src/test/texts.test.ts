import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import texts from '../i18n/es.json';
import meta from '../i18n/texts.meta.json';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['mocks', 'test'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}
test('cada texto tiene tipo, fuente y validación pendiente', () => {
  expect(Object.keys(meta).sort()).toEqual(Object.keys(texts).sort());
  for (const item of Object.values(meta)) {
    expect(['UI', 'SEG', 'CLÍN']).toContain(item.tipo);
    expect(item.fuente.length).toBeGreaterThan(10);
    expect(item.estado).toBe('pendiente de validar');
  }
});
test('los TSX no contienen texto visible literal; todas las claves literales existen', () => {
  const violations: string[] = [];
  for (const path of files('src')) {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const report = (node: ts.Node, message: string) => violations.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${message}`);
    function walk(node: ts.Node) {
      if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) report(node, 'Texto JSX literal');
      if (ts.isJsxAttribute(node) && /^(aria-label|placeholder|title|alt|label)$/.test(node.name.getText(source))) {
        const init = node.initializer;
        const literal = init && ts.isStringLiteral(init) ? init : init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression) ? init.expression : null;
        if (literal && /\p{L}/u.test(literal.text)) report(node, 'Atributo literal');
      }
      if (ts.isCallExpression(node) && ['t', 'tDynamic'].includes(node.expression.getText(source))) {
        const key = node.arguments[0];
        if (key && ts.isStringLiteral(key) && !(key.text in texts)) report(node, `Clave inexistente: ${key.text}`);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
    expect(readFileSync(path, 'utf8')).not.toMatch(new RegExp('[\\u00c3\\u00c2\\ufffd]'));
  }
  expect(violations).toEqual([]);
});
