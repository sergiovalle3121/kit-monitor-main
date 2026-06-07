import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `cycle_counts` — inventory-accuracy cycle counts.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateCycleCounts20260607220000 implements MigrationInterface {
  name = 'CreateCycleCounts20260607220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('cycle_counts')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "cycle_counts" (
        "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"    character varying(36),
        "organization_id" character varying(36),
        "plant_id"     character varying(36),
        "folio"        character varying(32),
        "part_number"  character varying(80) NOT NULL,
        "location"     character varying(120),
        "uom"          character varying(12) NOT NULL DEFAULT 'PCS',
        "system_qty"   double precision NOT NULL DEFAULT 0,
        "counted_qty"  double precision,
        "variance"     double precision,
        "status"       character varying(12) NOT NULL DEFAULT 'OPEN',
        "counted_by"   character varying(200),
        "program_id"   character varying(64),
        "counted_at"   TIMESTAMP,
        "created_at"   TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP,
        "created_by"   character varying(255),
        CONSTRAINT "PK_cycle_counts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_cc_scope_status" ON "cycle_counts" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cycle_counts_folio" ON "cycle_counts" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cycle_counts_part" ON "cycle_counts" ("part_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cycle_counts_program" ON "cycle_counts" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('cycle_counts')) {
      await queryRunner.query(`DROP TABLE "cycle_counts"`);
    }
  }
}
