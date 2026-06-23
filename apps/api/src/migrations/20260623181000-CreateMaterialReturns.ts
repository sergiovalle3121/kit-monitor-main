import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `material_returns` — devoluciones de material al almacén (return to stock).
 * Tabla nueva, todas las columnas nullable o con default. Idempotente (salta si
 * TypeORM `synchronize` ya la creó).
 */
export class CreateMaterialReturns20260623181000 implements MigrationInterface {
  name = 'CreateMaterialReturns20260623181000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('material_returns')) return;

    await queryRunner.query(`
      CREATE TABLE "material_returns" (
        "id"            SERIAL NOT NULL,
        "returnNumber"  character varying(32) NOT NULL,
        "status"        character varying(32) NOT NULL DEFAULT 'pending',
        "partNumber"    character varying(100) NOT NULL,
        "description"   character varying(200),
        "quantity"      double precision NOT NULL,
        "uom"           character varying(16),
        "batch"         character varying(100),
        "vendor"        character varying(120),
        "project"       character varying(120),
        "fromLocation"  character varying(100),
        "toWarehouseId" character varying(64) NOT NULL,
        "toLocation"    character varying(100),
        "reason"        character varying(64),
        "notes"         text,
        "restocked"     boolean NOT NULL DEFAULT false,
        "createdBy"     character varying(120),
        "completedBy"   character varying(120),
        "completedAt"   TIMESTAMP,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_material_returns" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_material_returns_number" UNIQUE ("returnNumber")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_material_returns_part" ON "material_returns" ("partNumber")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('material_returns')) {
      await queryRunner.query(`DROP TABLE "material_returns"`);
    }
  }
}
