import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Structured MES context for material pull requests.
 *
 * Fully additive: all columns are nullable and the migration skips cleanly when
 * synchronize already materialized the entity shape.
 */
export class AddMaterialRequestContext20260629120000
  implements MigrationInterface
{
  name = 'AddMaterialRequestContext20260629120000';

  private readonly cols: Array<{ name: string; ddl: string }> = [
    { name: 'workOrder', ddl: `ADD "workOrder" character varying(80)` },
    { name: 'line', ddl: `ADD "line" character varying(40)` },
    { name: 'station', ddl: `ADD "station" character varying(120)` },
    { name: 'partNumber', ddl: `ADD "partNumber" character varying(120)` },
    { name: 'requestedQty', ddl: `ADD "requestedQty" double precision` },
    { name: 'unit', ddl: `ADD "unit" character varying(24)` },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('material_requests'))) return;
    for (const col of this.cols) {
      if (!(await queryRunner.hasColumn('material_requests', col.name))) {
        await queryRunner.query(`ALTER TABLE "material_requests" ${col.ddl}`);
      }
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_material_requests_partNumber" ON "material_requests" ("partNumber")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('material_requests'))) return;
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_material_requests_partNumber"`,
    );
    for (const col of [...this.cols].reverse()) {
      if (await queryRunner.hasColumn('material_requests', col.name)) {
        await queryRunner.query(
          `ALTER TABLE "material_requests" DROP COLUMN "${col.name}"`,
        );
      }
    }
  }
}
