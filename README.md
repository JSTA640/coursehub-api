# CourseHub API

API educativa desarrollada con NestJS, TypeORM y PostgreSQL para gestionar cursos, estudiantes y matrículas persistentes.

## Requisitos e instalación

- Node.js 20 o superior.
- npm.
- PostgreSQL 14 o superior.

```powershell
npm install
Copy-Item .env.example .env
```

Configura en `.env` los valores de conexión de tu PostgreSQL local (crea antes
la base indicada en `DB_NAME`).

> **Advertencia:** `.env` contiene credenciales reales, está en `.gitignore` y
> **no se comparte ni se entrega**. Solo `.env.example` (con valores ficticios)
> forma parte del repositorio.

## Variables de entorno

Todas se validan con Joi al iniciar ([env.validation.ts](src/config/env.validation.ts)).
Si falta una obligatoria o tiene un valor inválido, la API se detiene con un
mensaje que nombra la variable.

| Variable | Obligatoria | Valor por defecto | Descripción |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test` o `production`. |
| `PORT` | No | `3000` | Puerto HTTP de la API. |
| `DB_HOST` | Sí | — | Host de PostgreSQL. |
| `DB_PORT` | No | `5432` | Puerto de PostgreSQL. |
| `DB_NAME` | Sí | — | Nombre de la base de datos. |
| `DB_USER` | Sí | — | Usuario de PostgreSQL. |
| `DB_PASSWORD` | Sí | — | Contraseña (vacía solo fuera de producción). |
| `LOG_LEVEL` | No | `log` | `debug`, `log`, `warn` o `error`. |
| `JWT_SECRET` | Sí | — | Secreto aleatorio de al menos 32 caracteres; solo en `.env` o el entorno seguro. |
| `JWT_EXPIRES_IN` | No | `15m` | Duración del token de acceso; unidades admitidas: `ms`, `s`, `m`, `h`, `d`, `w`, `y`. |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Orígenes web permitidos, separados por comas (`esquema://host[:puerto]`). No admite `*`. |

## Ambientes

La conexión se construye en [typeorm.config.ts](src/config/typeorm.config.ts)
con `TypeOrmModule.forRootAsync` y `ConfigService`; no hay host, usuario ni
contraseña escritos en TypeScript.

| Decisión | Desarrollo | Producción |
| --- | --- | --- |
| Fuente de valores | `.env` local | Variables seguras del entorno de despliegue |
| `synchronize` | `true` (solo con `NODE_ENV=development`) | `false` |
| Cambios de esquema | Ajuste local desechable | Migraciones revisadas |

Al iniciar se registra una línea sin secretos, por ejemplo
`[TypeORM] env=production host=localhost port=5432 db=coursehub synchronize=false`.
Nunca se registran el usuario ni la contraseña.

## Ejecución

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

La API queda disponible en `http://localhost:<PORT>` (por defecto
`http://localhost:3000`; los ejemplos usan ese puerto). Los módulos de cursos,
estudiantes y matrículas usan la misma conexión PostgreSQL; estudiantes y
matrículas permanecen almacenados tras reiniciar la API.

## Endpoints

| Método | Ruta | Descripción | Parámetros / body | Acceso |
| --- | --- | --- | --- | --- |
| `POST` | `/courses` | Crea un curso; el propietario es el usuario autenticado. | `{ "title": "Bases de datos", "level": "beginner" }` | JWT · `admin`, `teacher` |
| `GET` | `/courses` | Lista cursos con paginación y orden estable. | `level`, `page`, `limit`, `sortBy`, `order` opcionales | Público |
| `GET` | `/courses/:id` | Consulta curso. | ID positivo | Público |
| `PATCH` | `/courses/:id` | Modifica curso. | Body parcial validado por `UpdateCourseDto` | JWT · `admin` o `teacher` propietario |
| `DELETE` | `/courses/:id` | Elimina curso sin matrículas. | ID positivo | JWT · `admin` |
| `POST` | `/students` | Crea estudiante. | `name`, `email`, `age`, `career`, `semester`; `isActive` opcional | Público |
| `GET` | `/students` | Lista estudiantes. | Filtros opcionales combinables: `career`, `semester`, `isActive` | Público |
| `GET` | `/students/:id` | Consulta estudiante. | ID de estudiante | Público |
| `PATCH` | `/students/:id` | Modifica estudiante. | Body parcial validado por `UpdateStudentDto` | Público |
| `PATCH` | `/students/:id/status` | Cambia el estado activo. | `{ "isActive": false }` | Público |
| `DELETE` | `/students/:id` | Elimina estudiante activo sin matrículas. | ID de estudiante | Público |
| `POST` | `/enrollments` | Crea matrícula. | `{ "studentId": 1, "courseId": 1 }` | Público |
| `GET` | `/enrollments` | Busca y pagina matrículas incluyendo estudiante y curso. | `search`, `studentId`, `courseId`, `activeOnly`, `page`, `limit` | Público |
| `GET` | `/students/:studentId/enrollments` | Lista matrículas del estudiante. | ID de estudiante | Público |
| `GET` | `/courses/:courseId/enrollments` | Lista matrículas del curso. | ID de curso | Público |
| `DELETE` | `/enrollments/:id` | Cancela matrícula. | ID de matrícula | Público |
| `POST` | `/auth/register` | Registra una cuenta de usuario. | `{ "email": "ana@example.com", "password": "…" }` | Público |
| `POST` | `/auth/login` | Comprueba las credenciales y emite un token de acceso. | `{ "email": "ana@example.com", "password": "…" }` | Público |
| `GET` | `/auth/me` | Devuelve la identidad del token autenticado. | — | JWT |
| `GET` | `/diagnostics/unexpected-error` | Provoca un error inesperado de práctica (500 genérico). En producción responde `404`. | — | Público (solo desarrollo) |

## Registro de usuarios

`POST /auth/register` crea una cuenta (`User`, tabla `users`) y responde `201`
con `{ id, email, createdAt }`. El correo se limpia y pasa a minúsculas; la
contraseña debe tener entre 8 y 72 caracteres y se transforma con bcrypt
(12 rondas) antes de guardarse en `password_hash`. Ni la contraseña ni el hash
aparecen en respuestas o registros. Un correo repetido responde `409` y una
entrada inválida `400`. `User` es independiente de `Student`. Detalle y
evidencias en [docs/sesion-15-registro.md](docs/sesion-15-registro.md).

`POST /auth/login` compara la contraseña recibida con el hash persistido usando
`bcrypt.compare` y, si coincide, responde `200` con `{ accessToken, user }`.
El token es un JWT firmado cuya carga contiene únicamente `sub` (ID), `email` y `role`;
incluye también `iat` y `exp`. Su vencimiento predeterminado es de 15 minutos.
El payload de un JWT está firmado, no cifrado: no publiques ni compartas el
token y no incluyas secretos en él. Una cuenta inexistente o una contraseña
incorrecta responde `401` con el mismo mensaje genérico; una entrada inválida
responde `400`. Emitir un token no implementa por sí solo autorización: ver
[Roles, permisos y propiedad](#roles-permisos-y-propiedad-sesión-19).

## Protección de rutas con JWT

`JwtStrategy` de Passport extrae el token del encabezado
`Authorization: Bearer <token>`, verifica firma y expiración y prepara en
`request.user` únicamente `{ id, email, role }` (un token sin rol válido → `401`). `JwtAuthGuard` aplica esa estrategia
en las rutas marcadas explícitamente. `GET /auth/me` y las rutas de escritura de
cursos (`POST`, `PATCH`, `DELETE`) requieren un JWT; sin credencial, con una credencial alterada o expirada responden `401`
antes de ejecutar el controlador. El registro, el login y las demás rutas aún
no protegidas permanecen públicas en esta etapa. Autenticación válida no implica
autorización para todas las acciones: los roles y la propiedad se describen en la
sección siguiente.

## Roles, permisos y propiedad (Sesión 19)

Un JWT válido prueba **quién** hace la solicitud, no **qué** puede hacer. Por eso
las rutas de escritura de cursos aplican tres capas, en este orden:

1. `JwtAuthGuard` — identidad. Sin token, token alterado o expirado → `401`.
2. `RolesGuard` + `@Roles(...)` — permiso por rol. Rol no incluido → `403`.
3. `CoursesService.update` — propiedad. Un `teacher` solo modifica cursos cuyo
   `createdByUserId` coincide con su `id`; si no → `403`. `admin` gestiona cualquiera.

`User.role` es una enumeración cerrada (`admin`, `teacher`, `student`) con valor
por defecto `student` (menor privilegio). `POST /auth/register` no acepta `role`:
el `ValidationPipe` con `forbidNonWhitelisted` responde `400` si se envía.
`Course.createdByUserId` se toma siempre de `request.user.id`; el cliente no
puede enviarlo en `POST` ni en `PATCH` (`400`).

| Acción | Sin token | `student` | `teacher` ajeno | `teacher` propietario | `admin` |
| --- | --- | --- | --- | --- | --- |
| `POST /courses` | 401 | 403 | 201 | 201 | 201 |
| `PATCH /courses/:id` | 401 | 403 | 403 | 200 | 200 |
| `DELETE /courses/:id` | 401 | 403 | 403 | 403 | 200 |

**Identidad mínima autenticada:** el token y `request.user` contienen solo
`{ id, email, role }`. `id` permite evaluar la propiedad y `role` el permiso;
`email` se conserva para `/auth/me`. El rol viaja firmado en el JWT, así que un
cambio de rol se aplica cuando la persona vuelve a iniciar sesión (como máximo
`JWT_EXPIRES_IN`, 15 min por defecto).

Asignación controlada de roles en la base **local** (después de registrar las
cuentas de práctica con `POST /auth/register`; usa correos y contraseñas ficticios):

```sql
UPDATE users SET role = 'admin'   WHERE email = 'admin@example.com';
UPDATE users SET role = 'teacher' WHERE email = 'docente@example.com';
-- estudiante@example.com conserva el valor por defecto 'student'
```

Los cursos creados antes de esta sesión tienen `created_by_user_id = NULL` y solo
un `admin` puede modificarlos. Detalle y respuestas de cierre en
[docs/sesion-19-autorizacion.md](docs/sesion-19-autorizacion.md).

## Controles de seguridad para una API pública (Sesión 20)

La API aplica **defensa en profundidad**: ninguna capa sustituye a otra.

| Riesgo | Control principal | Control complementario |
| --- | --- | --- |
| Cuerpo malformado | DTO y `ValidationPipe` | Límite de tamaño de petición (100 kb por defecto en Express) |
| Token robado en tránsito | HTTPS/TLS | Vencimiento corto del JWT (`15m`) |
| Fuerza bruta de login | Rate limit (5/min) | Mensaje genérico `401` y hash bcrypt |
| Acción sin permiso | Roles y propiedad | Registro de auditoría |
| Sitio web no autorizado | CORS | JWT y autorización en el servidor |

**CORS.** Se habilita en `main.ts` solo para los orígenes de `CORS_ORIGINS`, con
métodos `GET, POST, PATCH, DELETE` y encabezados `Content-Type, Authorization`.
CORS solo indica a un **navegador** qué sitios pueden leer las respuestas; no
impide que Postman, un script o un servidor llamen a la API. Las rutas
protegidas siguen exigiendo JWT aunque el origen esté permitido.

**Rate limit.** `@nestjs/throttler` se aplica globalmente con 20 solicitudes por
minuto por IP; `POST /auth/login` está limitado a **5 intentos por minuto**. Al
superarlo la API responde `429 Too Many Requests` con un mensaje genérico y el
encabezado `Retry-After`, sin indicar si el correo o la contraseña eran
correctos. Los contadores viven en memoria: se reinician al reiniciar la API y no
se comparten entre varias instancias.

> **Reglas de despliegue**
> - **Producción requiere HTTPS.** Sin TLS, un token Bearer puede interceptarse y
>   reutilizarse aunque su firma sea válida. `http://localhost` solo se admite en
>   desarrollo; en producción la terminación TLS se realiza en el proxy,
>   balanceador o plataforma de despliegue.
> - **Los secretos viven solo en el entorno** (`.env` local o variables seguras
>   de la plataforma): `JWT_SECRET`, `DB_PASSWORD`, etc. Nunca en el código, el
>   repositorio, los logs ni las respuestas.
> - Detrás de un proxy, configura `trust proxy` para que el rate limit use la IP
>   real del cliente y no la del proxy.

Detalle y respuestas de cierre en
[docs/sesion-20-seguridad.md](docs/sesion-20-seguridad.md).

## Componentes transversales (Sesión 21)

Cada preocupación transversal vive en un único componente global, sin
`try/catch`, validaciones manuales ni logs repetidos en los controladores.

Orden real de ejecución en NestJS:

```text
Solicitud → middleware → guard → interceptor (antes) → pipe → controlador → interceptor (después) → respuesta
                                           ↘ filter si ocurre una excepción en cualquier etapa
```

| Componente | Archivo | Responsabilidad |
| --- | --- | --- |
| Middleware | `src/common/middleware/request-logger.middleware.ts` | Genera `X-Request-Id` y registra `method`, `path` (sin query), `status` y `durationMs` de cada solicitud. |
| Guards | `JwtAuthGuard`, `RolesGuard`, `ThrottlerGuard` | Deciden si la solicitud continúa (401, 403, 429). |
| Pipes | `ValidationPipe` global, `ParseIntPipe`, `ParseIdPipe` | Validan y transforman el cuerpo y los parámetros (400). |
| Interceptor | `src/common/interceptors/timing.interceptor.ts` | Mide la duración del método, añade `X-Response-Time` y lo registra; no oculta errores. |
| Filter | `src/common/filters/http-error.filter.ts` | Traduce cualquier excepción a la forma de error uniforme. |

Forma pública de todos los errores:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "El curso con ID 99 no existe",
  "path": "/courses/99",
  "timestamp": "2026-11-16T15:04:05.000Z",
  "requestId": "6f1c…"
}
```

Un error inesperado responde siempre `500` con `"message": "Internal server error"`:
la traza, las consultas SQL y las variables de entorno solo aparecen en el
registro interno, enlazadas por el mismo `requestId`. Los registros **nunca**
incluyen `Authorization`, tokens, contraseñas, cuerpos de petición ni la query
string. Detalle y cierre en
[docs/sesion-21-componentes-transversales.md](docs/sesion-21-componentes-transversales.md).

## Persistencia, reglas y respuestas

El listado de cursos responde `{ items, meta }`. `page` inicia en `1`,
`limit` en `10` (máximo `50`), `sortBy` admite `id`, `title` o `level`, y
`order` admite `ASC` o `DESC`. El orden predeterminado es por `id` ascendente.
El filtro `level` es opcional y exacto. Por ejemplo:

```http
GET /courses?level=beginner&page=2&limit=5&sortBy=title&order=ASC
```

La respuesta contiene los cursos de la página en `items` y metadatos
`total`, `page`, `limit` y `totalPages` en `meta`. Valores como `page=0`,
`limit=200`, `sortBy=createdAt` u `order=sideways` producen `400 Bad Request`.

La entidad `Student` tiene correo único en PostgreSQL. El servicio también
comprueba duplicados y normaliza el correo sin distinguir mayúsculas; si la
restricción detecta una carrera entre solicitudes, la API responde igualmente
`409 Conflict`.

`Enrollment` almacena relaciones obligatorias con `Student` y `Course` mediante
claves foráneas. La base de datos impide repetir la pareja estudiante–curso y el
servicio verifica los duplicados antes de guardar. Los listados cargan las dos
entidades relacionadas. Para crear una matrícula, el estudiante y el curso
deben existir, y el estudiante debe estar activo.

`GET /enrollments` responde `{ items, meta }`. `page` inicia en `1` y `limit`
en `10` (máximo `50`). Los filtros opcionales `studentId` y `courseId` se
combinan; `activeOnly=true` limita a matrículas de estudiantes activos.
`search` busca sin distinguir mayúsculas en nombre del estudiante y título del
curso. La búsqueda se parametriza en la consulta y los resultados se ordenan
por ID de matrícula ascendente. Una colección sin coincidencias responde `200`
con `items: []` y `meta.total: 0`. Ejemplo:

```http
GET /enrollments?search=nest&activeOnly=true&page=1&limit=5
```

| Estado | Situación |
| --- | --- |
| `400 Bad Request` | Datos/filtros inválidos, ID no positivo o estudiante inactivo. |
| `404 Not Found` | Estudiante, curso o matrícula inexistente. |
| `409 Conflict` | Correo o matrícula duplicados; estudiante/curso con matrículas existentes no se elimina. |
| `204 No Content` | Cancelación exitosa de matrícula. |

La aplicación activa un `ValidationPipe` global con `whitelist`,
`forbidNonWhitelisted` y `transform`. El pipe personalizado
[parse-id.pipe.ts](src/common/pipes/parse-id.pipe.ts) valida los IDs de las
rutas de matrículas como enteros positivos.

## Demostración reproducible

Con PostgreSQL y la API locales en ejecución, crea un curso y un estudiante
(cambia el correo si repites la demostración):

```powershell
$course = Invoke-RestMethod -Method Post http://localhost:3000/courses `
  -ContentType 'application/json' `
  -Body '{"title":"Bases de datos","level":"Inicial"}'
$student = Invoke-RestMethod -Method Post http://localhost:3000/students `
  -ContentType 'application/json' `
  -Body '{"name":"Ana Torres","email":"ana.torres@example.edu","age":20,"career":"Software","semester":4,"isActive":true}'
$enrollment = Invoke-RestMethod -Method Post http://localhost:3000/enrollments `
  -ContentType 'application/json' `
  -Body (@{ studentId = $student.id; courseId = $course.id } | ConvertTo-Json)
```

Reinicia la API y consulta los mismos recursos:

```powershell
Invoke-RestMethod "http://localhost:3000/students/$($student.id)"
Invoke-RestMethod "http://localhost:3000/enrollments?studentId=$($student.id)&courseId=$($course.id)"
Invoke-RestMethod "http://localhost:3000/students/$($student.id)/enrollments"
Invoke-RestMethod "http://localhost:3000/courses/$($course.id)/enrollments"
```

Repite `POST /enrollments` con los mismos IDs y `POST /students` con el correo
repetido: ambos deben responder `409`. Crea otro estudiante con
`"isActive": false` e intenta matricularlo: debe responder `400`. Finalmente,
elimina la matrícula con `DELETE /enrollments/:id` y comprueba que dejó de
aparecer en los listados.

```powershell
$inactive = Invoke-RestMethod -Method Post http://localhost:3000/students `
  -ContentType 'application/json' `
  -Body '{"name":"Leo Inactivo","email":"leo.inactivo@example.edu","age":21,"career":"Software","semester":3,"isActive":false}'
# Espera 409: el correo del primer estudiante ya existe.
try {
  Invoke-RestMethod -Method Post http://localhost:3000/students `
    -ContentType 'application/json' `
    -Body '{"name":"Otra Ana","email":"ana.torres@example.edu","age":20,"career":"Software","semester":4}'
} catch { $_.Exception.Response.StatusCode }
# Espera 409: la misma pareja estudiante–curso ya está matriculada.
try {
  Invoke-RestMethod -Method Post http://localhost:3000/enrollments `
    -ContentType 'application/json' `
    -Body (@{ studentId = $student.id; courseId = $course.id } | ConvertTo-Json)
} catch { $_.Exception.Response.StatusCode }
# Espera 400: el estudiante existe pero está inactivo.
try {
  Invoke-RestMethod -Method Post http://localhost:3000/enrollments `
    -ContentType 'application/json' `
    -Body (@{ studentId = $inactive.id; courseId = $course.id } | ConvertTo-Json)
} catch { $_.Exception.Response.StatusCode }
Invoke-RestMethod "http://localhost:3000/students?career=Software&semester=4&isActive=true"
Invoke-RestMethod -Method Delete "http://localhost:3000/enrollments/$($enrollment.id)"
Invoke-RestMethod "http://localhost:3000/enrollments?studentId=$($student.id)&courseId=$($course.id)"
```

## Pruebas

```bash
npm test
npm run test:e2e
npm run test:cov
```

Las pruebas unitarias ejercitan las reglas de los servicios (incluidos los
conflictos concurrentes, el filtrado y la paginación). Las pruebas E2E verifican
los endpoints y sus validaciones contra PostgreSQL, incluida la persistencia
después de reiniciar y las búsquedas sin coincidencias.

## Estructura principal

```text
src/
  courses/
  students/
  enrollments/
  users/
  auth/
  common/pipes/parse-id.pipe.ts
  config/
    env.validation.ts
    logger.config.ts
    typeorm.config.ts
  app.module.ts
  main.ts
```
