# Desplegar NP_Front en Vercel

Primero despliega NP_Back y aplica sus migraciones de Supabase. No se requiere modificar la URL dentro del código cuando Vercel la asigne.

## Configuración del proyecto

Importa este repositorio en Vercel: raíz `.`, preset Vite, Node 24.x, instalación `npm ci`, build `npm run build`, salida `dist`. Estos valores ya están en vercel.json (salvo la selección de Node).

## Variables

| Variable | Valor en Vercel |
| --- | --- |
| `VITE_USE_MOCKS` | `false` |
| `VITE_API_BASE_URL` | `/api/v1` |
| `NP_BACKEND_ORIGIN` | `https://URL-REAL-DEL-BACKEND.vercel.app`, sin rutas, query ni credenciales |
| `NP_PROXY_SECRET` | Misma clave aleatoria de al menos 32 caracteres configurada en NP_Back |

Las dos variables NP_* se leen solo en la función de servidor `api/proxy.mjs`. **No les pongas prefijo VITE_**. No añadas la contraseña de PostgreSQL, NP_DATABASE_URL ni NP_SECRET_KEY a NP_Front.

No hace falta `VITE_PROXY_TARGET` en Vercel: pertenece al servidor de desarrollo local de Vite.

Después de añadir o cambiar variables, redespliega. Configura NP_CORS_ORIGIN del backend con el dominio real de esta web. Para previews usa las variables correspondientes a ese entorno; no conectes previews arbitrarias a una base con información real.

## Enrutamiento y cookies

`vercel.json` dirige `/api/v1/*` al proxy de servidor. La función lee NP_BACKEND_ORIGIN, reenvía cuerpos, tokens y cookies, devuelve Set-Cookie sin cambiar sus atributos e impide cachear respuestas. Las demás rutas de React tienen fallback a index.html; los archivos estáticos se conservan mediante filesystem.

La función obtiene la IP de la cabecera establecida por Vercel y la remite con la clave compartida. No es un proxy abierto: el destino solo procede de configuración del servidor y debe ser un origen HTTPS. Si falta configuración devuelve 503, sin intentar un dominio de ejemplo. Los fallos de red devuelven 502 sin revelar detalles del destino ni secretos.

El proxy usa el runtime Node con fetch y getSetCookie disponibles en Node 24. No cambia la autenticación de FastAPI ni guarda tokens de acceso en el navegador.

## Compatibilidad de las respuestas

La web adapta authorId de notas, deviceModel del visor y gaze desde payload de nivel a sus modelos de vista. Trata nombres/fechas/métricas nulos sin convertirlos en resultados clínicos. El gráfico de progreso obtiene el historial para tener toleranceIndex, que no viene en lastSessions de ProgressOut.

El backend no publica una consulta del nivel inicial permitido actual. Por eso la edición del plan empieza sin selección cuando ese valor no está disponible; no se presupone que el nivel guardado sea 1. Esta ampliación del contrato sigue pendiente.

## Comprobar

```sh
npm run typecheck
npm test
npm run test:proxy
npm run build
npm run check:mojibake
```

En el despliegue: abre `/api/v1/health`, registra un paciente de prueba, inicia sesión, recarga, cierra sesión y recarga directamente `/paciente`. Comprueba roles, notas y visor contra la API real.

Si antes activaste el simulador en el mismo origen, elimina el service worker de MSW y la cookie de demostración desde las herramientas del navegador antes de validar. No cambies la cookie real a una cookie legible.

La configuración queda preparada para desplegar; la prueba efectiva de HTTPS, cookies y conectividad a Supabase se completa en los proyectos reales, una vez introducidas sus variables.
