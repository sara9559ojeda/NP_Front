import { readFileSync, writeFileSync } from 'node:fs';
const texts = JSON.parse(readFileSync('src/i18n/es.json', 'utf8'));
function metadata(key) {
  let tipo = 'UI';
  let fuente = 'Redacción de interfaz propuesta; encargo web HU-05 a HU-14';
  if (/^(disclaimer|consent|account\.withdraw|register\.consent)/.test(key)) {
    tipo = 'SEG'; fuente = 'Decisiones D19, D23; contrato §3, §4.1; texto propuesto de APROBAR_R1 §9 (resumen facilitado por Sara)';
  } else if (/^(error|fieldError|validation|login\.sessionExpired|forbidden|admin\.noClinical)/.test(key)) {
    tipo = 'SEG'; fuente = 'Contrato §2.3, §4 y §8; mensajes de interfaz propuestos';
  } else if (/^(clinical|recommendation|analysis|chart|suds|metric|outcome|endReason|session\.|stats\.|plan\.)/.test(key)) {
    tipo = 'CLÍN'; fuente = 'Contrato §5–§7; HU-11 a HU-13; etiquetas propuestas';
    if (key.startsWith('suds.')) fuente = 'Contrato §6.3; escala SUDS (Wolpe, 1969), según encargo';
  } else if (/^level\.[1-5]\.name$/.test(key)) {
    tipo = 'CLÍN'; fuente = 'Nombres de niveles de los wireframes de Sara (resumen facilitado; documento original no disponible en este equipo)';
  } else if (key.startsWith('home.') || key === 'app.tagline') {
    fuente = 'Resumen facilitado por Sara: metodología §1.6.1, §1.7, §1.8 y wireframe 11; originales no disponibles en este equipo';
  } else if (key.startsWith('role.')) fuente = 'RQF004 y contrato §2.1';
  if (key === 'disclaimer.body') fuente = 'Texto exacto facilitado por Sara: propuesta APROBAR_R1 §9';
  if (key === 'validation.passwordLength' || key === 'register.password.hint') fuente = 'Política provisional de interfaz: mínimo 8 caracteres; pendiente de contrato';
  return { tipo, fuente, estado: 'pendiente de validar' };
}
writeFileSync('src/i18n/texts.meta.json', JSON.stringify(Object.fromEntries(Object.keys(texts).map(key => [key, metadata(key)])), null, 2) + '\n', 'utf8');
