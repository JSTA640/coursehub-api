# Sesión 20 · Controles de seguridad para una API pública

## Implementación

| Control | Archivo | Configuración |
| --- | --- | --- |
| CORS | `src/main.ts`, `src/config/cors.config.ts` | Orígenes de `CORS_ORIGINS` (por defecto `http://localhost:5173`); métodos `GET, POST, PATCH, DELETE`; encabezados `Content-Type, Authorization`. |
| Validación de `CORS_ORIGINS` | `src/config/env.validation.ts` | Solo `esquema://host[:puerto]`; rechaza `*`, rutas y barras finales. |
| Rate limit global | `src/app.module.ts` | `ThrottlerModule` con 20 solicitudes / 60 s por IP y `ThrottlerGuard` como guard global. |
| Rate limit de login | `src/auth/auth.controller.ts` | `@Throttle({ default: { limit: 5, ttl: 60_000 } })` en `POST /auth/login`. |
| Respuesta 429 | `src/app.module.ts` | `{ "statusCode": 429, "message": "Too many requests, please try again later" }` + `Retry-After`. |

## Evidencia automatizada

- `src/config/cors.config.spec.ts`: origen permitido recibe
  `Access-Control-Allow-Origin`; origen no permitido no lo recibe; el preflight
  devuelve métodos y encabezados permitidos; una ruta protegida sigue
  respondiendo `401` aunque el origen esté permitido; una petición sin `Origin`
  (Postman/script) no se ve afectada por CORS.
- `src/auth/auth.throttle.spec.ts`: cinco intentos de login responden `401` y
  el sexto `429`, sin datos de la cuenta y sin consultar la base de datos.
- `src/config/env.validation.spec.ts`: valor por defecto de `CORS_ORIGINS` y
  rechazo de `*` o de orígenes mal formados.

## Prueba manual de CORS desde el navegador

1. Con la API en marcha, sirve cualquier carpeta en el origen permitido:
   `npx http-server -p 5173` y abre `http://localhost:5173`.
2. En la consola del navegador (F12) ejecuta
   `fetch('http://localhost:3001/courses').then(r => r.json()).then(console.log)`:
   la respuesta se lee correctamente.
3. Repite el mismo `fetch` desde un origen no permitido (por ejemplo, la
   consola de `https://example.com`): el navegador bloquea la lectura con un
   error de CORS. La petición llegó al servidor; lo que se impide es que ese
   sitio lea la respuesta.

## Cierre

**¿Por qué CORS no protege una API de Postman?**
CORS es una política que aplica el **navegador** para que un sitio web no lea
respuestas de otro origen sin permiso. Postman, `curl`, un script o un servidor
no son navegadores: no envían la petición previa (preflight) ni respetan los
encabezados `Access-Control-*`, así que reciben la respuesta igualmente. Por eso
la protección real de las rutas sigue estando en el servidor: JWT, roles,
propiedad y validación.

**¿Qué información no debe aparecer en la respuesta de un rate limit?**
Nada que ayude a un atacante: si el correo existe, si la contraseña era
correcta o casi correcta, cuántos usuarios hay, detalles internos (stack traces,
IP de otros clientes, configuración del servidor o de la base de datos) ni datos
de la cuenta. Solo debe indicar que se superó el límite (`429`) y, como mucho,
cuánto esperar (`Retry-After`).

**¿Por qué un token en HTTP es un riesgo aun si su firma es correcta?**
La firma garantiza que el token no fue **modificado**, pero no lo **oculta**. Por
HTTP viaja en texto plano: cualquiera en la misma red (wifi pública, proxy,
router comprometido) puede copiarlo y reutilizarlo tal cual. Como su firma sigue
siendo válida, la API aceptará al atacante como si fuera el usuario legítimo
hasta que el token expire. HTTPS cifra el tráfico e impide esa interceptación;
el vencimiento corto solo reduce el tiempo de exposición.
