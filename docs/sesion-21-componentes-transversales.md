# Sesión 21 · Middleware, pipes, filters e interceptors

## Qué se implementó

| Componente | Archivo | Registro | Qué hace |
| --- | --- | --- | --- |
| `RequestLoggerMiddleware` | `src/common/middleware/request-logger.middleware.ts` | `AppModule.configure()` para todas las rutas | Asigna un `X-Request-Id` y, al terminar la respuesta, registra `{ requestId, method, path, status, durationMs }`. |
| `ValidationPipe` | `src/main.ts` | Global | Valida los DTO (`whitelist`, `forbidNonWhitelisted`, `transform`). |
| `ParseIntPipe` | Controladores | Por parámetro | Convierte `:id` a número; `GET /courses/:id` ya no usa `Number(id)`. |
| `HttpErrorFilter` | `src/common/filters/http-error.filter.ts` | `APP_FILTER` | Forma uniforme `{ statusCode, error, message, path, timestamp, requestId }`. |
| `TimingInterceptor` | `src/common/interceptors/timing.interceptor.ts` | `APP_INTERCEPTOR` | Cabecera `X-Response-Time` y registro `{ handler, method, path, outcome, durationMs }`. |
| `DiagnosticsController` | `src/diagnostics/diagnostics.controller.ts` | `AppModule` | `GET /diagnostics/unexpected-error` lanza un error de práctica (404 en producción). |

**Nota sobre el orden.** En NestJS el interceptor se ejecuta *antes* que los
pipes (middleware → guards → interceptors → pipes → controlador). Por eso el
`TimingInterceptor` también registra, con `outcome: "error"`, una solicitud que
el `ParseIntPipe` rechaza; el controlador, en cambio, nunca llega a ejecutarse.

## Datos que nunca se registran

`Authorization`, tokens, contraseñas, cookies, el cuerpo de la petición y la
query string (puede contener términos de búsqueda o datos personales). El
`path` se registra sin `?…`.

## Comparación: respuesta pública frente a registro interno

| Caso | Solicitud | Respuesta pública | Registro interno |
| --- | --- | --- | --- |
| 400 | `GET /courses/abc` | `400`, `"Validation failed (numeric string is expected)"` | `WARN [HttpErrorFilter] GET /courses/abc 400 requestId=…` y la línea `[HTTP]` con `status: 400`. |
| 404 | `GET /courses/99999` | `404`, `"El curso con ID 99999 no existe"` | `WARN [HttpErrorFilter] … 404 …`, `[Timing] outcome: "error"`, `[HTTP] status: 404`. |
| 500 | `GET /diagnostics/unexpected-error` | `500`, `"Internal server error"` (sin traza ni SQL) | `ERROR [HttpErrorFilter] … Error: Simulated failure: SELECT … at …` con la traza completa y el mismo `requestId`. |

El `requestId` que recibe el cliente permite localizar en los registros el
detalle exacto de un error sin habérselo mostrado.

Evidencia automatizada: `src/common/http-pipeline.spec.ts` y el caso
*uniform public errors* de `test/app.e2e-spec.ts`.

## Cierre

| Situación | Componente | Por qué ese y no otro |
| --- | --- | --- |
| **Token inválido** | **Guard** (`JwtAuthGuard`) → `401` | Decide si la solicitud puede continuar, antes del controlador y con acceso a la metadata de la ruta (`@Roles`). Un middleware no conoce la ruta ni sus decoradores; un pipe valida datos, no identidades; un interceptor se ejecuta después de los guards y un filter solo actúa cuando ya hay una excepción. |
| **Id no numérico** | **Pipe** (`ParseIntPipe`) → `400` | Transformar y validar un parámetro es exactamente la responsabilidad del pipe, y lo hace antes de que el método se ejecute. Hacerlo con `Number(id)` en cada controlador duplica código y deja pasar `NaN`; un guard no debe validar formatos de datos. |
| **Recurso inexistente** | El **servicio** lanza `NotFoundException`; el **filter** la traduce a `404` | Solo el servicio sabe, tras consultar la base de datos, que el recurso no existe. El filter da la forma HTTP uniforme sin `try/catch` en cada controlador. Un pipe o un guard no deberían consultar la base para esto. |
| **Operación lenta** | **Interceptor** (`TimingInterceptor`) | Envuelve el método antes y después, así que puede medir su duración sin tocar la lógica de negocio. Un middleware mide la solicitud entera pero no sabe qué método la atendió; un filter solo actúa ante errores; un pipe no ve el resultado. |
