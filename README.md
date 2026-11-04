# NEUROPHOBIA — Web

Interfaz web del sistema NEUROPHOBIA, prototipo académico de realidad virtual para apoyar el tratamiento de la aracnofobia mediante exposición gradual. Trabajo de grado de **Sara María Ojeda López**, Ingeniería de Software, Universidad Cooperativa de Colombia (Pasto, 2026).

> NEUROPHOBIA no es un dispositivo médico ni sustituye a un terapeuta. Se usa con el acompañamiento de un profesional de la salud.

## Para quién es

- **Usuario externo:** información sobre la aplicación y registro.
- **Paciente:** sus datos, su progreso, vincular el visor y retirar el consentimiento.
- **Profesional de la salud:** sus pacientes, sesiones, notas y nivel inicial permitido.
- **Administrador:** usuarios, roles, asignaciones y exportación anónima, sin acceso a datos clínicos.

## Tecnologías

React con TypeScript (Vite), Vitest y Testing Library, y un servidor simulado (MSW) para desarrollar sin backend.

## Contrato de la API

La web sigue el contrato aprobado. Su fuente está en el repositorio del backend. Aquí se guarda una **copia fijada** en [`docs/api/CONTRATO_API_v1.md`](docs/api/CONTRATO_API_v1.md), que no se edita en este repositorio.

## Repositorios relacionados

- Backend (FastAPI): https://github.com/sara9559ojeda/NP_Back
- App de realidad virtual (Unity): https://github.com/sara9559ojeda/NPdefdef

## Puesta en marcha

Para publicar con la API real: [Vercel y variables del proxy](docs/DESPLIEGUE_VERCEL.md). La configuración ya está en `vercel.json`; la URL real del backend se introduce como `NP_BACKEND_ORIGIN` en el servidor de Vercel, sin editar código.

Requiere Node >=20.19.0; verificado con Node **24.19.0** y npm **11.6.2**. Las dependencias tienen versiones exactas y `package-lock.json` se versiona.

```sh
npm ci
npm run dev
```

Abre `http://localhost:5173`. El puerto es fijo. MSW se activa por defecto en desarrollo; todos los datos son **ficticios**, viven en memoria y los cambios se pierden al recargar. La cookie simulada permite restaurar la sesión de las cuentas de ejemplo, pero no conserva perfiles nuevos ni sus cambios.

Si falla la descarga, reintenta con `npm ci --fetch-retries=5`. Si falta el worker: `npx msw init public`.

### Cuentas del simulador

Contraseña de prueba para las cuentas de ejemplo: **`demo-neurophobia`** (`DEMO_PASSWORD`, solo en MSW). No es una credencial del backend.

| Rol / caso | Correo |
| --- | --- |
| Paciente, Ana Pérez | `ana@example.com` |
| Profesional, Marta Gómez | `profesional@neurophobia.test` |
| Profesional, Andrés Benavides | `profesional2@neurophobia.test` |
| Administrador, Valeria Rosero | `admin@neurophobia.test` |
| Paciente sin asignación | `julian@neurophobia.test` |
| Cuenta desactivada (423) | `inactivo@neurophobia.test` |
| Error interno simulado (500) | `error@neurophobia.test` |

Cinco intentos fallidos para el mismo correo activan un 429 en el simulador. Una recarga reconstruye la base de ejemplo. Lucía está asignada a Andrés: Marta recibe 404 al intentar consultar sus datos. El administrador no consulta datos clínicos.

## Comprobaciones

```sh
npm run typecheck
npm test
npm run build
npm run check:mojibake
npm run texts:table
```

Vitest, Testing Library y MSW verifican autenticación, renovación compartida del token, permisos, formularios, notas, paginación y errores. Axe comprueba infracciones graves en las pantallas principales en jsdom; el contraste se revisa visualmente porque jsdom no implementa el renderizado necesario. Estas pruebas no certifican accesibilidad ni validación clínica.

`src/i18n/es.json` centraliza los textos; `texts.meta.json` conserva tipo, fuente y estado **pendiente de validar**. `texts:table` genera la tabla para revisión. La prueba estática con el compilador TypeScript rechaza textos JSX y atributos visibles escritos como literales y claves inexistentes. Los textos clínicos y de seguridad deben ser aprobados antes de un uso con participantes.

GitHub Actions ejecuta instalación reproducible, TypeScript, pruebas, UTF-8 y compilación en cada PR. La compilación de producción **no activa el simulador por defecto**.

## Backend real

Copia `.env.example` a `.env.local` y configura:

```dotenv
VITE_API_BASE_URL=/api/v1
VITE_USE_MOCKS=false
VITE_PROXY_TARGET=http://localhost:8000
```

Reinicia Vite. El proxy `/api` mantiene el mismo origen para la cookie de refresco. Si antes usaste MSW en ese origen, desregistra el service worker desde las herramientas del navegador y limpia la cookie de demostración antes de probar el backend real. El proxy solo existe en desarrollo: el servidor de entrega deberá dirigir `/api/v1` al backend y soportar rutas del cliente con fallback a `index.html`.

El token de acceso vive exclusivamente en memoria. Las peticiones usan `credentials: include`; el backend debe emitir la cookie HttpOnly, Secure y SameSite=Strict, con ruta `/api/v1/auth`. La cookie `np_refresh` del simulador es legible y usa `Path=/` por limitaciones de MSW; no debe copiarse como implementación de producción. No hay secretos en variables `VITE_*`: todo su contenido es público.

## Tipos y versión del contrato

La especificación fijada es **NP_Back@contrato-v1.0.0**, aprobada el 30-10-2026. Los tipos actuales están escritos desde el contrato en `src/api/types.ts`. Los campos no definidos completamente están marcados como `Assumed`/`assumed`; las formas elegidas por el simulador están pendientes de aprobación.

Cuando se publique el OpenAPI aprobado, guarda su copia en `docs/api/openapi.json` y ejecuta en una rama de integración:

```sh
npm run gen:api-types
```

La salida será `src/api/generated/openapi.ts`; después adapta los alias y valida cliente y simulador contra el backend. El comando no puede ejecutarse aún porque el OpenAPI no está incluido.

## Estructura

```text
src/api/          Tipos, transporte y funciones por ruta
src/auth/         Sesión en memoria y protección por rol
src/components/   Formularios, layouts, métricas y vinculación
src/hooks/        Carga, errores y paginación
src/i18n/         Textos y fuentes para aprobación
src/mocks/        Datos ficticios y handlers MSW
src/pages/        Vistas públicas y por rol
src/styles/       Tema oscuro, escritorio y móvil
src/test/         Pruebas de flujo, API, accesibilidad y textos
scripts/          Tabla de textos y comprobación UTF-8
```

## Límites y pendientes

- Consentimiento informado: `[pendiente: texto del consentimiento informado aprobado por el asesor]`.
- Conservación: `[pendiente: plazo de conservación de los datos (D23)]`.
- El mínimo de ocho caracteres para contraseñas es provisional, pendiente de contrato.
- Las recomendaciones muestran «Pendiente de validar» y no actualizan el plan por sí solas. Las sesiones de prueba no tienen análisis ni se incluyen en la exportación del simulador.
- Falta integración con el backend y sus cookies reales, aprobación de textos y resolución de las formas ambiguas del contrato.
- La auditoría de las versiones fijadas reporta avisos en herramientas de desarrollo (`vitest`, `tinypool`, `@vitest/mocker`, `openapi-typescript` y dependencias). Requieren una actualización compatible y verificada; no ejecutar `npm audit fix --force` sin revisar los cambios mayores. Mantener los servidores de desarrollo y pruebas en el equipo local.
