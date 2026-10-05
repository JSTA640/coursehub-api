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

Configura en `.env` los valores de conexión de tu PostgreSQL local. No publiques
ese archivo: las variables necesarias aparecen sin credenciales reales en
`.env.example`. En `NODE_ENV=development`, TypeORM sincroniza las entidades para
esta práctica. La sincronización queda desactivada en cualquier otro entorno.

## Ejecución

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

La API queda disponible en `http://localhost:3000`. Los módulos de cursos,
estudiantes y matrículas usan la misma conexión PostgreSQL; estudiantes y
matrículas permanecen almacenados tras reiniciar la API.

## Endpoints

| Método | Ruta | Descripción | Parámetros / body |
| --- | --- | --- | --- |
| `POST` | `/courses` | Crea un curso. | `{ "title": "Bases de datos", "level": "Inicial" }` |
| `GET` | `/courses` | Lista cursos. | Filtro opcional `level` |
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
| `GET` | `/enrollments` | Lista matrículas con estudiante y curso. | `studentId` y `courseId` opcionales y combinables |
| `GET` | `/students/:studentId/enrollments` | Lista matrículas del estudiante. | ID de estudiante |
| `GET` | `/courses/:courseId/enrollments` | Lista matrículas del curso. | ID de curso |
| `DELETE` | `/enrollments/:id` | Cancela matrícula. | ID de matrícula |

## Persistencia, reglas y respuestas

La entidad `Student` tiene correo único en PostgreSQL. El servicio también
comprueba duplicados y normaliza el correo sin distinguir mayúsculas; si la
restricción detecta una carrera entre solicitudes, la API responde igualmente
`409 Conflict`.

`Enrollment` almacena relaciones obligatorias con `Student` y `Course` mediante
claves foráneas. La base de datos impide repetir la pareja estudiante–curso y el
servicio verifica los duplicados antes de guardar. Los listados cargan las dos
entidades relacionadas. Para crear una matrícula, el estudiante y el curso
deben existir, y el estudiante debe estar activo.

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
conflictos concurrentes y los errores de recursos inexistentes). La secuencia
anterior verifica los siete casos requeridos contra PostgreSQL, incluida la
persistencia después de reiniciar.

## Estructura principal

```text
src/
  courses/
  students/
  enrollments/
  common/pipes/parse-id.pipe.ts
  app.module.ts
  main.ts
```
