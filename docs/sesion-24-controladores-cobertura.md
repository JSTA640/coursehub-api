# Sesión 24 · Controladores, cobertura y calidad de pruebas

## 1. Prueba del controlador que delega

`src/courses/courses.controller.spec.ts` registra `CoursesController` con sus
dependencias **simuladas** (`CoursesService` y `UpdateCourseUseCase`). No se
simula el controlador: es la unidad bajo prueba.

```ts
const updateCourse = { execute: jest.fn<AnyAsync>() };

const module = await Test.createTestingModule({
  controllers: [CoursesController],
  providers: [
    { provide: CoursesService, useValue: coursesService },
    { provide: UpdateCourseUseCase, useValue: updateCourse },
  ],
}).compile();
```

En CourseHub el controlador recibe la identidad desde `request.user` (la deja
`JwtAuthGuard`), así que la prueba construye esa solicitud con
`requestFrom(teacher)`.

| Prueba (salida de Jest) | Qué protege |
| --- | --- |
| `delegates update with the id, body and authenticated user` | Llama a `execute(7, dto, teacher)` una sola vez y devuelve su resultado |
| `does not modify the body before passing it to the use case` | El DTO llega intacto y es el mismo objeto |
| `propagates a ForbiddenException from the use case instead of returning a fake 200` | El 403 del caso de uso no se traga |
| `propagates a NotFoundException from the use case` | El 404 llega al cliente |
| `does not use CoursesService for updates` | La edición pasa solo por el caso de uso |
| `passes the validated query DTO to findAll` | Lista con el query validado |
| `delegates findOne with the parsed id and propagates its 404` | Consulta por id |
| `delegates create with the body and the authenticated user as owner` | El dueño sale del token, no del body |
| `delegates remove with the parsed id` | Eliminar por id |

**No se prueba aquí** si el docente es propietario: eso pertenece a
`UpdateCourseUseCase` (Sesión 23). El contrato HTTP completo (401, 403, 400 y
guards reales) está en `courses.controller.auth.spec.ts`.

También se quitó del mock un `update` de `CoursesService` que ya no existe desde
la Sesión 22: simular métodos inexistentes da pruebas que pasan sin proteger nada.

## 2. Cobertura

```bash
npm run test:cov          # equivale a: npm test -- --coverage
```

| Archivo | Antes (Stmts / Branch / Lines) | Después |
| --- | --- | --- |
| `courses.controller.ts` | 92.85 / 67.85 / 92.3 (línea 42 sin cubrir) | 100 / 67.85 / 100 |
| `courses.service.ts` | 40 / 26.31 / 39.13 (líneas 39-41, 51-69) | 100 / 94.73 / 100 |
| **Total del proyecto** | 74.43 / 68.58 / 75.63 | 77.7 / 72.5 / 79.11 |

Total de pruebas: 106 → 119.

### Rama relevante que no estaba cubierta

`CoursesService.remove`: **«no se puede eliminar un curso con matrículas»**.
Si PostgreSQL rechaza el borrado por clave foránea (`23503`), la API responde
`409`; cualquier otro error debe propagarse tal cual. Ninguna prueba unitaria
ejecutaba esa rama. Se añadieron en `courses.service.spec.ts`:

| Prueba | Expectativa |
| --- | --- |
| `returns 404 with the course id when the course does not exist` | `NotFoundException` con el mensaje exacto |
| `removes an existing course and returns it` | `remove` llamado con el curso |
| `does not try to remove a course that does not exist` | `remove` **no** llamado |
| `rejects deleting a course with enrollments with 409 (foreign key 23503)` | `ConflictException` con el mensaje exacto |
| `rethrows unexpected database errors instead of hiding them as 409` | se propaga el error original |
| `rethrows errors without a driverError unchanged` | se propaga el error original |

### Lo que el porcentaje no dice

`courses.controller.ts` tiene **100 % de líneas pero 67.85 % de ramas**
(líneas 31-60). Esas «ramas» no son lógica de CourseHub: las genera TypeScript
para los metadatos de los decoradores (`emitDecoratorMetadata`). Perseguirlas no
añadiría ninguna protección. La cobertura es una **señal** para encontrar rutas
sin probar, no un objetivo.

## 3. Fallo intencional

Se cambió temporalmente el controlador para que copiara el body:

```ts
return this.updateCourse.execute(id, { ...dto }, request.user);
```

```text
● CoursesController › update (PATCH /courses/:id) › does not modify the body before passing it to the use case
Tests: 1 failed, 8 passed, 9 total
```

La cobertura seguía en 100 % de líneas: la línea se ejecutaba igual. Solo una
expectativa significativa (`toBe(dto)`) detectó el cambio. Se restauró el código.

## 4. Calidad de las pruebas

| Pregunta | Evidencia en CourseHub |
| --- | --- |
| ¿Se ejecutó la rama de rechazo? | Cobertura de `remove` y pruebas de 404/409 |
| ¿La regla es correcta? | `toThrow(new ConflictException('...'))`, no solo «lanza algo» |
| ¿La prueba es independiente? | `jest.clearAllMocks()` en `beforeEach`; sin reloj, red ni base local |
| ¿El nombre explica el contrato? | `rejects deleting a course with enrollments with 409 (foreign key 23503)` |

Qué se simula en cada nivel:

| Unidad bajo prueba | Se simula | No se simula |
| --- | --- | --- |
| `CoursesController` | `UpdateCourseUseCase`, `CoursesService` | el controlador |
| `UpdateCourseUseCase` | `CourseRepository` | el caso de uso |
| `CoursesService` | `Repository<Course>` de TypeORM | el servicio |

## Cierre

**¿Por qué un 100 % de cobertura no autoriza eliminar la revisión de código?**
La cobertura solo dice que una línea **se ejecutó**, no que su resultado se
comprobó ni que la regla sea la correcta. El fallo intencional lo demuestra: el
controlador seguía en 100 % de líneas aunque cambiaba lo que enviaba. Además, la
cobertura no detecta lo que **falta** (una regla que nadie escribió), los errores
de diseño, los problemas de seguridad, los nombres engañosos ni las pruebas que
simulan la propia unidad. La revisión humana evalúa la intención; la cobertura
solo mide la ejecución.

**¿Qué prueba unitaria agregarías antes de modificar la regla de propiedad?**
Una prueba de `UpdateCourseUseCase` que fije el comportamiento actual en el
borde que el cambio va a tocar. Por ejemplo, si se van a permitir co-docentes:

```ts
it('rejects a teacher who is not the owner even if they teach another course', ...)
```

Junto con las que ya existen (dueño sí, otro docente no, curso sin dueño no y
`save` no llamado al rechazar), esta prueba fija la regla actual. Así, el cambio
nuevo empieza con una prueba en rojo que describe la regla nueva, y las demás
confirman que no se abrió el acceso a nadie más.
