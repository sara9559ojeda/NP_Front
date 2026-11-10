# Web en AWS

La migración preparada conserva React/Vite y la API relativa `/api/v1`.

La arquitectura elegida sirve `dist` mediante nginx en EC2, detrás de CloudFront con un origen VPC privado, y dirige `/api/*` a FastAPI en esa misma instancia. PostgreSQL también reside en EC2, sin puerto público. La cookie de refresco permanece en el mismo origen HTTPS; no se publica el proxy Node de Vercel ni se incorporan secretos al build.

```powershell
$env:VITE_USE_MOCKS = 'false'
$env:VITE_API_BASE_URL = '/api/v1'
npm ci
npm run typecheck
npm run build
```

Compilar desde PowerShell. En Git Bash, `VITE_API_BASE_URL=/api/v1` se convierte en una ruta de Windows (`C:/Program Files/Git/api/v1`) y la web publicada no llega a la API; si hay que usar Git Bash, anteponer `MSYS_NO_PATHCONV=1`. Comprobar después que `dist/assets/*.js` no contiene `Program Files`.

Para actualizar solo la web no se usa `deploy.py` (crea la pila y no actualiza sin revisar un change set): se sube el `dist` empaquetado a `deployments/frontend-<sha256>.tar.gz` y, por SSM, se verifica el SHA-256 y se reemplaza `/opt/neurophobia/frontend`, conservando la versión anterior como `frontend.prev-<fecha>`. CloudFront no cachea, así que no hace falta invalidar.

El empaquetador de `NP_AWS_Back/infra/ec2/deploy.py` omite `mockServiceWorker.js`. nginx conserva los tipos MIME y las rutas React reciben `index.html`; los errores API no usan ese fallback. CloudFront no cachea respuestas autenticadas.

El procedimiento completo, costo, datos, APK y estado de despliegue están en `NP_AWS_Back/docs/DESPLIEGUE_AWS_EC2.md`, en la carpeta hermana de este repositorio.

Después de publicar, probar login, refresco tras recarga, logout y acceso directo a rutas por rol. Si el origen tuvo un worker MSW, retirarlo antes de validar. Para pruebas locales en Node 26 usar `NODE_OPTIONS=--no-experimental-webstorage`; evita el conflicto entre su almacenamiento experimental y jsdom.
