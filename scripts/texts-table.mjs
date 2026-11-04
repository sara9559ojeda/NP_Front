import { readFileSync } from 'node:fs';
const texts = JSON.parse(readFileSync(new URL('../src/i18n/es.json', import.meta.url), 'utf8'));
const meta = JSON.parse(readFileSync(new URL('../src/i18n/texts.meta.json', import.meta.url), 'utf8'));
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
console.log('| Clave | Texto | Tipo | Fuente |');
console.log('| --- | --- | --- | --- |');
for (const [key, value] of Object.entries(texts)) {
  if (!meta[key]) throw new Error(`Falta metadata: ${key}`);
  console.log(`| ${escape(key)} | ${escape(value)} | ${escape(meta[key].tipo)} | ${escape(meta[key].fuente)} |`);
}
