# Sesión 19 · Roles, permisos y propiedad de recursos

## 401 frente a 403

| Respuesta | Significado | Ejemplo en CourseHub |
| --- | --- | --- |
| `401 Unauthorized` | No existe una identidad válida. | `PATCH /courses/10` sin token, con firma alterada o expirada. |
| `403 Forbidden` | La identidad existe, pero no tiene permiso. | Un `student` intenta `DELETE /courses/10`; un `teacher` edita un curso ajeno. |

## Decisiones de implementación

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| `UserRole` | `src/users/user-role.enum.ts` | Enumeración cerrada `admin` / `teacher` / `student`. |
| `User.role` | `src/users/entities/user.entity.ts` | Columna `enum`, por defecto `student` (menor privilegio). |
| Claims del JWT | `src/auth/auth.service.ts`, `src/auth/strategies/jwt.strategy.ts` | El token firma `{ sub, email, role }`; la estrategia rechaza (`401`) un rol ausente o desconocido. |
| `@Roles()` | `src/auth/decorators/roles.decorator.ts` | Declara la política junto a la ruta; no concede nada por sí solo. |
| `RolesGuard` | `src/auth/guards/roles.guard.ts` | Lee la metadata y compara con `request.user.role`. Va **después** de `JwtAuthGuard`. |
| Propiedad | `src/courses/courses.service.ts` (`update`); desde la Sesión 22, `UpdateCourseUseCase` | `admin` o `course.createdByUserId === actor.id`; si no, `ForbiddenException`. |
| Propietario | `Course.createdByUserId` | Se asigna en `create` desde `request.user.id`. El DTO no lo admite. |

Política aplicada en `CoursesController`:

```ts
@Post()          @UseGuards(JwtAuthGuard, RolesGuard) @Roles(ADMIN, TEACHER)  // + dueño = actor
@Patch(':id')    @UseGuards(JwtAuthGuard, RolesGuard) @Roles(ADMIN, TEACHER)  // + propiedad en servicio
@Delete(':id')   @UseGuards(JwtAuthGuard, RolesGuard) @Roles(ADMIN)
```

`RolesGuard` puede filtrar `student` en `PATCH` sin consultar la base de datos,
pero no puede saber si un `teacher` creó el curso: esa regla depende del recurso
concreto y por eso vive en el servicio, que carga el curso antes de decidir.

## Matriz de acceso probada

Evidencia automatizada en `src/courses/courses.controller.auth.spec.ts`
(HTTP real con Supertest, JWT firmado y guards reales) y
`src/courses/courses.service.spec.ts` (regla de propiedad).

| Acción | Sin token | `student` | `teacher` ajeno | `teacher` propietario | `admin` |
| --- | --- | --- | --- | --- | --- |
| `POST /courses` | 401 | 403 | 201 | 201 | 201 |
| `PATCH /courses/:id` | 401 | 403 | 403 | 200 | 200 |
| `DELETE /courses/:id` | 401 | 403 | 403 | 403 | 200 |

Casos adicionales: enviar `createdByUserId` en el body de `POST` o `PATCH`
responde `400` sin llegar al servicio; un curso antiguo sin propietario
(`NULL`) solo lo modifica un `admin`.

## Cuentas de práctica

Registra tres cuentas ficticias con `POST /auth/register` y asigna los roles
directamente en tu base **local** (nunca a través de la API pública):

```sql
UPDATE users SET role = 'admin'   WHERE email = 'admin@example.com';
UPDATE users SET role = 'teacher' WHERE email = 'docente@example.com';
-- estudiante@example.com conserva 'student'
```

Vuelve a iniciar sesión después de cambiar un rol: el rol viaja en el JWT y el
token anterior conserva el rol antiguo hasta que expira.

## Información mínima de la identidad autenticada

Para evaluar estas reglas `request.user` necesita solo:

- `id` → comparar con `createdByUserId` (propiedad).
- `role` → comparar con `@Roles(...)` (permiso).

`email` se mantiene únicamente para `GET /auth/me`. Nada más (ni contraseña,
ni hash, ni datos personales) se incluye en el token.

## Cierre

**¿Por qué un token válido no basta para borrar un curso?**
El token solo demuestra autenticación: que la solicitud proviene de una cuenta
real y que la firma no fue alterada. Cualquier cuenta registrada (incluida una
estudiante creada hace un minuto) puede obtener un token válido. Borrar un curso
es una acción administrativa con impacto sobre otras personas, así que además de
saber *quién* es, la API debe verificar *qué* puede hacer (rol) y, cuando aplica,
*sobre qué* recurso (propiedad). Por eso `DELETE` exige `admin` y responde `403`
a cualquier otro rol aunque su token sea válido.

**¿Qué riesgo aparece si el propietario se toma del body?**
El cuerpo HTTP lo controla por completo el cliente. Si la API confiara en un
`ownerId`/`createdByUserId` enviado en la solicitud, un docente podría:

- declararse propietario de un curso ajeno y modificarlo (escalada horizontal de
  privilegios, tipo IDOR / *mass assignment*);
- reasignar un curso propio a otra persona o crear cursos a nombre de terceros,
  falsificando la auditoría.

En CourseHub el propietario sale siempre de `request.user.id`, que proviene de
un JWT firmado por el servidor, y los DTO no declaran `createdByUserId`, de modo
que `forbidNonWhitelisted` rechaza el intento con `400`.
