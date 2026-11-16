# Sesión 22 · Casos de uso, repositorios y adaptadores

## Operación elegida

`PATCH /courses/:id` (actualizar un curso). Antes, `CoursesService.update`
mezclaba la consulta TypeORM, la regla de propiedad y el guardado. Ahora:

```text
CoursesController          ← HTTP: guards (401/403 por rol), ParseIntPipe, UpdateCourseDto
      ↓
UpdateCourseUseCase        ← regla de negocio: propietario o admin; si no, 403
      ↓
CourseRepository (puerto)  ← findById(id), save(course)
      ↓
TypeOrmCourseRepository    ← Repository<Course>.findOneBy / save
      ↓
PostgreSQL
```

## Archivos

| Capa | Archivo | Responsabilidad |
| --- | --- | --- |
| Puerto | `src/courses/application/ports/course.repository.ts` | Interfaz `CourseRepository` y token `COURSE_REPOSITORY`. Solo dos métodos: los que necesita el caso de uso. |
| Caso de uso | `src/courses/application/use-cases/update-course.use-case.ts` | Busca el curso (404), aplica la regla de propiedad (403) y guarda. No importa TypeORM. |
| Adaptador | `src/courses/infrastructure/typeorm-course.repository.ts` | Implementa el puerto con TypeORM. |
| Registro | `src/courses/course.module.ts` | `{ provide: COURSE_REPOSITORY, useClass: TypeOrmCourseRepository }`. |
| Controlador | `src/courses/courses.controller.ts` | `update()` llama a `updateCourse.execute(...)`; mismas rutas, guards y DTO. |

`CoursesService` conserva listar, consultar, crear y eliminar; ya no tiene
`update`, así que la regla existe en un solo lugar.

## Contrato HTTP conservado

| Caso | Antes | Después |
| --- | --- | --- |
| Sin token | 401 | 401 |
| `student` | 403 `Forbidden resource` | 403 `Forbidden resource` |
| `teacher` ajeno | 403 `You cannot modify this course` | 403 `You cannot modify this course` |
| Propietario / admin | 200 | 200 |
| Curso inexistente | 404 `El curso con ID X no existe` | 404 `El curso con ID X no existe` |
| `createdByUserId` en el body | 400 | 400 |

## Pruebas

- `update-course.use-case.spec.ts`: la regla con un **repositorio falso en
  memoria**. Sin Nest, sin HTTP y sin PostgreSQL: el caso de uso se construye
  con `new UpdateCourseUseCase(repositorioFalso)`.
- `typeorm-course.repository.spec.ts`: el adaptador traduce `findById` →
  `findOneBy({ id })` y `save` → `save`.
- `courses.controller.auth.spec.ts`: el contrato HTTP (401/403/200/400) con el
  caso de uso sustituido.
- `test/app.e2e-spec.ts`: `PATCH` real contra PostgreSQL (200, 404 y 401).

## SOLID aplicado

| Principio | En CourseHub |
| --- | --- |
| Responsabilidad única | El controlador cambia por HTTP, el caso de uso por la regla, el adaptador por la persistencia. |
| Abierto/cerrado | Un nuevo almacenamiento se añade con otro adaptador, sin tocar el caso de uso. |
| Sustitución | `InMemoryCourseRepository` (pruebas) y `TypeOrmCourseRepository` (producción) son intercambiables. |
| Segregación | El puerto solo pide `findById` y `save`. |
| Inversión de dependencias | `UpdateCourseUseCase` depende de `CourseRepository`, no de `Repository<Course>` de TypeORM. |

## Cierre

- **Si se reemplaza TypeORM** (por Prisma, otra base o una API externa) cambia
  **`TypeOrmCourseRepository`**: se escribe un adaptador nuevo que cumpla
  `CourseRepository` y se cambia el `useClass` en `CourseModule`. El caso de uso
  y el controlador no se tocan.
- **Si cambia la regla «solo el propietario puede editar»** (por ejemplo, que
  también puedan editar los co-docentes) cambia **`UpdateCourseUseCase`**. El
  adaptador y el controlador no se tocan.

Son dos clases distintas, cada una con una sola razón para cambiar: la
separación cumple su objetivo.
