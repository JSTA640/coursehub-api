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

| Método | Ruta | Descripción | Parámetros / body |
| --- | --- | --- | --- |
| `POST` | `/courses` | Crea un curso. | `{ "title": "Bases de datos", "level": "Inicial" }` |
| `GET` | `/courses` | Lista cursos con paginación y orden estable. | `level`, `page`, `limit`, `sortBy`, `order` opcionales |
| `GET` | `/courses/:id` | Consulta curso. | ID positivo |
| `PATCH` | `/courses/:id` | Modifica curso. | Body parcial de curso |
| `DELETE` | `/courses/:id` | Elimina curso sin matrículas. | ID positivo |
| `POST` | `/students` | Crea estudiante. | `name`, `email`, `age`, `career`, `semester`; `isActive` opcional |
| `GET` | `/students` | Lista estudiantes. | Filtros opcionales combinables: `career`, `semester`, `isActive` |
| `GET` | `/students/:id` | Consulta estudiante. | ID de estudiante |
| `PATCH` | `/students/:id` | Modifica estudiante. | Body parcial validado por `UpdateStudentDto` |
| `PATCH` | `/students/:id/status` | Cambia el estado activo. | `{ "isActive": false }` |
| `DELETE` | `/students/:id` | Elimina estudiante activo sin matrículas. | ID de estudiante |
| `POST` | `/enrollments` | Crea matrícula. | `{ "studentId": 1, "courseId": 1 }` |
| `GET` | `/enrollments` | Busca y pagina matrículas incluyendo estudiante y curso. | `search`, `studentId`, `courseId`, `activeOnly`, `page`, `limit` |
| `GET` | `/students/:studentId/enrollments` | Lista matrículas del estudiante. | ID de estudiante |
| `GET` | `/courses/:courseId/enrollments` | Lista matrículas del curso. | ID de curso |
| `DELETE` | `/enrollments/:id` | Cancela matrícula. | ID de matrícula |

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
  common/pipes/parse-id.pipe.ts
  config/
    env.validation.ts
    logger.config.ts
    typeorm.config.ts
  app.module.ts
  main.ts
```
