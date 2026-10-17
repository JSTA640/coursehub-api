# Propuesta de migración: descripción de cursos

> Propuesta, todavía **no se ejecuta**. Mientras tanto, en producción
> `synchronize` es `false`, por lo que este cambio solo puede llegar mediante
> una migración revisada.

## Cambio

Agregar a la tabla `courses` una columna opcional `description` (texto) para
mostrar un resumen de cada curso.

- **Nombre de la migración:** `AddDescriptionToCourses` (archivo con marca de
  tiempo, por ejemplo `1760700000000-AddDescriptionToCourses.ts`).
- **Entidad:** en `Course` se añadiría
  `@Column({ type: 'text', nullable: true }) description: string | null;`

Es `nullable` para que las filas existentes sigan siendo válidas sin
inventar datos.

## Migración

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionToCourses1760700000000 implements MigrationInterface {
  name = 'AddDescriptionToCourses1760700000000';

  // up: aplica el cambio.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courses" ADD "description" text`);
  }

  // down: revierte exactamente lo que hizo up.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "description"`);
  }
}
```

## Cómo se revertiría

`down` elimina la columna. Revertir **borra las descripciones guardadas**, así
que antes de ejecutarlo en producción hay que respaldar la tabla o confirmar que
esos datos pueden perderse.
