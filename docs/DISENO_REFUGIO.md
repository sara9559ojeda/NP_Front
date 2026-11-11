# Dirección visual «Refugio»

Rediseño del frontend de NEUROPHOBIA: un refugio entre montañas y bosque, con luz suave y una atmósfera serena. Debe transmitir calma, confianza, control y tecnología. No es un videojuego ni promete resultados clínicos.

Estado: **propuesta pendiente de aprobación de Sara**. Todos los textos nuevos están en `src/i18n/es.json` y marcados «pendiente de validar» en `src/i18n/texts.meta.json`.

## Identidad

- **Paleta** (`src/styles/tokens.css`): azul profundo (`--color-bg`, `--color-surface`), verde pino (`--color-pine`), tonos minerales (`--color-mineral`, líneas) y blanco cálido (`--color-text`). El acento luminoso (`--color-accent`) se reserva para acciones, elementos activos y foco. La única luz cálida de la escena es la ventana del refugio (`--color-lantern`).
- **Un solo tema oscuro**: el paisaje forma parte de la identidad. Los colores de texto cumplen AA sobre fondo y superficies.
- **Sin** degradados morados, neón, exceso de cristal translúcido, tarjetas repetidas ni decoración sin función. Sin arañas, estímulos amenazantes, sobresaltos ni sonido.
- La composición toma de los menús inmersivos la idea general (paisaje amplio, menú lateral con selección marcada, interfaz superpuesta), sin copiar logotipos, recursos ni elementos reconocibles de ningún juego.

## Página pública

- **Primera pantalla**: marca y acceso discretos en la cabecera, menú lateral (Información, Funcionamiento, Experiencia VR, Acompañamiento, Acceso e Iniciar sesión), mensaje breve y dos acciones: «Conocer la experiencia» y «Acceder».
- **Narrativa por scroll nativo** (`src/pages/public/HomePage.tsx`): 1) qué es NEUROPHOBIA, con el aviso de prototipo y la marca de contenido pendiente; 2) cómo se conecta la web con el visor; 3) los cinco niveles; 4) acompañamiento profesional; 5) qué consulta el paciente; 6) requisitos y acceso. No se secuestra la rueda ni se fuerzan desplazamientos.
- **Menú lateral**: marca la sección que se está leyendo (`aria-current="location"`), calculada con la posición de lectura; al final de la página siempre marca la última sección. En pantallas estrechas se convierte en una barra horizontal desplazable.

## Fondo ambiental (`src/scene/`)

- `terrain.ts`: forma compartida de las crestas (ruido determinista) y colores del cielo. La escena 3D y el respaldo SVG dibujan las mismas montañas, así que el cambio entre ambos no se nota.
- `LandscapeFallback.tsx`: paisaje estático en SVG. Se pinta siempre primero, así que la página se lee y se usa antes de (o sin) WebGL.
- `landscape.ts`: escena Three.js con geometría ligera y sombreado plano: cielo, cuatro planos de crestas, niebla, lago, bosque instanciado, refugio con una ventana cálida y bancos de bruma.
- `AmbientBackdrop.tsx`: capa fija detrás del contenido (`aria-hidden`); los controles siguen en HTML.

Movimiento, siempre lento:

- la cámara avanza y desciende suavemente según el progreso de lectura, y el cielo pasa de noche azul a un amanecer mineral;
- parallax ligero en las crestas del respaldo SVG;
- reacción mínima al puntero solo con puntero fino (escritorio);
- balanceo muy leve y bruma que deriva despacio.

Rendimiento y respaldo:

| Requisito | Implementación |
| --- | --- |
| Carga diferida | `import('./landscape')` en un fragmento propio, lanzado con `requestIdleCallback` (o 300 ms). |
| Sin WebGL o contexto perdido | Se queda el SVG estático; la página no depende de la escena. |
| `prefers-reduced-motion` | No se crea la escena ni se aplica parallax; queda el SVG estático. |
| Ahorro de datos | `navigator.connection.saveData` mantiene el SVG estático. |
| Móvil | Calidad baja: 90 árboles, 30 fps, sin antialias, relación de píxeles 1. |
| Pestaña oculta | `visibilitychange` detiene el bucle de render. |
| Resolución del canvas | Relación de píxeles limitada (1,5 o 1) y presupuesto total de 2,4 Mpx. |
| Limpieza | `dispose()` libera geometrías, materiales, texturas y el renderizador, y fuerza la pérdida de contexto. |
| Contraste | Un velo oscuro bajo el menú y la columna de lectura (≥ 72 % de opacidad) garantiza AA incluso con el cielo más claro; el paisaje se abre más allá. |

## Pantallas interiores

- **Inicio de sesión, registro y errores**: el mismo paisaje, quieto (posición fija) y con un velo más fuerte detrás del formulario.
- **Paneles por rol**: el fondo pasa a modo «calma» (SVG estático, atenuado y sin animación). El contenido vive en un panel opaco, así que tablas, notas y métricas nunca quedan sobre el paisaje. La navegación lateral usa el mismo marcador de selección que el menú público; en móvil, una barra horizontal.
- La información clínica no se convierte en puntuaciones, recompensas ni logros.

## Compatibilidad

No cambian rutas, contrato de la API, permisos, flujos, el token en memoria ni las cookies de sesión. No se modificó infraestructura ni backend.

## Limitaciones conocidas

- El fragmento de Three.js pesa unos 512 kB (131 kB comprimido). Solo se descarga en las páginas públicas, cuando el navegador está libre, y nunca bloquea el contenido. Vite muestra un aviso de tamaño por ese fragmento.
- En móvil vertical la cámara encuadra sobre todo el claro del bosque; las montañas se ven menos que en escritorio.
- El contraste se revisó con cálculo y de forma visual; jsdom no permite comprobarlo con axe.
