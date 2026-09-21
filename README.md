# API de Gestion Educativa

API desarrollada con NestJS para gestionar cursos, estudiantes y matriculas usando listas en memoria. El proyecto no utiliza PostgreSQL, TypeORM ni repositorios.

## Requisitos

- Node.js 20 o superior.
- npm.

## Instalacion

```bash
npm install
```

## Ejecucion

```bash
# Desarrollo
npm run start:dev

# Produccion
npm run build
npm run start:prod
```

La API queda disponible en `http://localhost:3000`.

## Modulos

- `CoursesModule`: administra cursos.
- `StudentsModule`: administra estudiantes y su estado activo/inactivo.
- `EnrollmentsModule`: registra, consulta y cancela matriculas.

La informacion se reinicia cuando se detiene la aplicacion.

## API de Matriculas

| Metodo | Ruta | Descripcion | Parametros, query o body |
| --- | --- | --- | --- |
| POST | `/enrollments` | Registra una nueva matricula. | Body: `{ "studentId": 1, "courseId": 2 }` |
| GET | `/enrollments` | Lista matriculas. | Query opcional: `?studentId=1&courseId=2` |
| GET | `/students/:studentId/enrollments` | Lista matriculas de un estudiante. | Parametro de ruta: `studentId` |
| GET | `/courses/:courseId/enrollments` | Lista matriculas de un curso. | Parametro de ruta: `courseId` |
| DELETE | `/enrollments/:id` | Cancela una matricula. | Parametro de ruta: `id` |

## Ejemplo: matricula valida

Antes de crear una matricula debe existir el estudiante y el curso. Los cursos iniciales disponibles tienen los IDs `1`, `2` y `3`.

```http
POST /enrollments
Content-Type: application/json

{
  "studentId": 1,
  "courseId": 1
}
```

Respuesta `201 Created`:

```json
{
  "id": 1,
  "studentId": 1,
  "courseId": 1
}
```

## Consultas y cancelacion

```http
GET /enrollments
GET /enrollments?studentId=1
GET /enrollments?courseId=1
GET /enrollments?studentId=1&courseId=1
GET /students/1/enrollments
GET /courses/1/enrollments
DELETE /enrollments/1
```

Una cancelacion exitosa responde con `204 No Content`.

## Reglas de negocio

- El estudiante debe existir.
- El curso debe existir.
- El estudiante debe estar activo.
- No se permite repetir la combinacion `studentId` y `courseId`.
- Los IDs de ruta deben ser enteros positivos.
- Los cuerpos JSON rechazan propiedades no declaradas en sus DTOs.

## Respuestas de error

| Estado | Situacion |
| --- | --- |
| `400 Bad Request` | ID invalido, datos incorrectos o estudiante inactivo. |
| `404 Not Found` | Estudiante, curso o matricula inexistente. |
| `409 Conflict` | La misma matricula ya existe. |

Ejemplo de matricula duplicada:

```json
{
  "statusCode": 409,
  "message": "El estudiante 1 ya esta matriculado en el curso 1",
  "error": "Conflict"
}
```

## Validacion

La aplicacion activa un `ValidationPipe` global con las opciones:

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

El pipe personalizado [parse-id.pipe.ts](src/common/pipes/parse-id.pipe.ts) transforma los IDs de ruta a numero y rechaza valores no positivos.

## Pruebas

```bash
npm test
npm run test:e2e
npm run test:cov
```

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
