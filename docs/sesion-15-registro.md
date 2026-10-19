# Sesión 15 · Registro de usuarios sin guardar contraseñas

`Student` representa a una persona del dominio académico; `User` representa una
cuenta que puede autenticarse. En esta sesión **no** se relacionan.

## Recorrido de una contraseña

```text
cliente  ──HTTPS──▶  POST /auth/register { email, password }
                         │
                         ▼
               RegisterDto (ValidationPipe)
               · email: trim + minúsculas, @IsEmail
               · password: string, 8–72 caracteres, sin transformar
                         │
                         ▼
               AuthService.register          ◀── ÚNICO punto donde existe
               · bcrypt.hash(password, 12)        el texto original (memoria,
                         │                        durante la solicitud)
                         ▼
               UsersService.create(email, passwordHash)
               · 409 si el correo existe (servicio + UNIQUE de PostgreSQL)
                         │
                         ▼
               PostgreSQL · users.password_hash  (solo el hash bcrypt)
                         │
                         ▼
               Respuesta 201 { id, email, createdAt }  (sin password ni hash)
```

`passwordHash` debe estar en la base porque es lo que permitirá verificar la
contraseña en el inicio de sesión (calculando y comparando con bcrypt). Debe
estar fuera de las respuestas porque un hash expuesto permite ataques de
fuerza bruta fuera de línea. Hay dos barreras: `select: false` en la entidad y
una respuesta construida explícitamente con campos seguros.

## Práctica guiada · resultados

| # | Petición | Esperado | Obtenido | ¿Crea fila? |
| --- | --- | --- | --- | --- |
| 1 | `ana@example.com` + contraseña válida | 201 con `id`, `email`, `createdAt` | 201 | Sí |
| 2 | `ANA@EXAMPLE.COM` + otra contraseña | 409 Conflict | 409 | No |
| 3 | Correo mal formado | 400 Bad Request | 400 | No |
| 4 | Contraseña de 7 caracteres | 400 Bad Request | 400 | No |

En PostgreSQL la tabla `users` tiene `id`, `email`, `password_hash` y
`created_at`; `password_hash` empieza por `$2b$12$` (bcrypt, 12 rondas) y mide
60 caracteres. El valor completo no se publica.

## Actividad autónoma · pruebas adicionales

| Prueba | Código esperado | ¿Crea fila? | Por qué |
| --- | --- | --- | --- |
| Cuerpo sin `email` | 400 | No | `@IsEmail` rechaza el valor ausente antes de llegar al servicio. |
| Cuerpo sin `password` | 400 | No | `@IsString` y `@MinLength(8)` fallan; no se calcula ningún hash. |
| Correo duplicado | 409 | No | El servicio detecta el correo existente; la restricción `UNIQUE` lo garantiza ante solicitudes simultáneas. |
| Campo extra `passwordHash` | 400 | No | `forbidNonWhitelisted` impide que el cliente inyecte propiedades. |

Ningún mensaje de error incluye la contraseña ni el hash.
