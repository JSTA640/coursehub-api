# Sesión 23 · Probar reglas de negocio con Jest

## Regla elegida

**Propiedad del curso** en `UpdateCourseUseCase`
(`src/courses/application/use-cases/update-course.use-case.ts`):

- curso inexistente → `404 El curso con ID X no existe`;
- docente que no es propietario (o curso sin propietario) → `403 You cannot modify this course`;
- propietario o administrador → se aplican los cambios y se llama a `save`.

## Repositorio simulado

`src/courses/application/use-cases/update-course.use-case.mock.spec.ts`
registra el caso de uso en un módulo de pruebas de Nest y sustituye el adaptador
TypeORM por un objeto con `jest.fn()`:

```ts
const courses = {
  findById: jest.fn<CourseRepository['findById']>(),
  save: jest.fn<CourseRepository['save']>(),
};

const module = await Test.createTestingModule({
  providers: [UpdateCourseUseCase, { provide: COURSE_REPOSITORY, useValue: courses }],
}).compile();
```

Cada prueba controla qué devuelve `findById` y verifica si se llamó a `save`.
`jest.clearAllMocks()` en `beforeEach` evita que una prueba dependa de otra.

## Pruebas (Arrange · Act · Assert)

| Prueba | Arrange (`findById`) | Assert |
| --- | --- | --- |
| `allows the owner teacher to update a course` | curso del docente 4 | título nuevo y `save` llamado una vez con el curso |
| `allows an admin to update a course created by someone else` | curso del docente 4 | nivel nuevo y `save` llamado |
| `responds 404 when the course does not exist and saves nothing` | `null` | `NotFoundException` con el mensaje exacto y `save` no llamado |
| `rejects an update from a different teacher` | curso del docente 4, actúa el 9 | `ForbiddenException` y `save` no llamado |
| `rejects teachers on legacy courses without an owner` | `createdByUserId: null` | `ForbiddenException` y `save` no llamado |

Conviven con la suite de la Sesión 22 (`update-course.use-case.spec.ts`), que
prueba la misma regla con un repositorio **falso** en memoria. Diferencia:

- **Falso** (in-memory): implementación funcional; se comprueba el *estado* final.
- **Simulado** (`jest.fn()`): sin lógica propia; se comprueban las *interacciones*
  (qué se llamó, con qué y cuántas veces).

## Ejecución

```bash
npm test -- update-course
```

```text
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
```

## Fallo intencional

Para comprobar que las pruebas protegen algo, se introdujo temporalmente un bug
en producción: guardar **antes** de validar la propiedad.

```ts
await this.courses.save(course); // BUG INTENCIONAL
const canManageAny = actor.role === UserRole.ADMIN;
```

Resultado:

```text
Expected number of calls: 0
Received number of calls: 1
Tests:       4 failed, 1 passed, 5 total
```

Las pruebas de 403 y del curso sin propietario **seguían lanzando
`ForbiddenException`** y aun así fallaron, porque `save` ya se había llamado.
Las de éxito fallaron por `toHaveBeenCalledTimes(1)` (recibió 2). El código se
restauró y la suite volvió a pasar.

## Cierre

**¿Por qué esta prueba no necesita PostgreSQL?** Porque `UpdateCourseUseCase`
depende del puerto `CourseRepository`, no de TypeORM. En la prueba, el token
`COURSE_REPOSITORY` se resuelve con un objeto de `jest.fn()`: no se abre ninguna
conexión ni se depende de datos previos. Lo que se prueba es la decisión
(propietario/admin/404/403), no la persistencia; esta última la cubren
`typeorm-course.repository.spec.ts` y las pruebas E2E.

**¿Qué diferencia hay entre probar que se lanzó `ForbiddenException` y probar que
no se llamó a `save`?** La primera comprueba la *respuesta* (el cliente recibe
403). La segunda comprueba el *efecto*: que no se modificaron datos. El fallo
intencional lo demuestra: con el bug, el 403 se seguía produciendo, pero el curso
ya estaba guardado. Una regla de seguridad que responde un error después de
modificar datos está incompleta; solo la aserción sobre `save` lo detecta.
