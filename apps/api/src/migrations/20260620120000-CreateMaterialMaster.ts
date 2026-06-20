import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the SAP-style MATERIAL MASTER (MM) tables:
 *   - mm_material      — canonical single source of parts (tenant-scoped)
 *   - mm_avl           — approved manufacturer list (part → many MPN)
 *   - mm_material_alt  — substitutes / alternates between materials
 *
 * Fully additive: brand-new prefixed tables, every column nullable or defaulted.
 * Idempotent (each table guarded by hasTable; skips when TypeORM `synchronize`
 * already created it on Railway). Coexists with the legacy `material_master`.
 */
export class CreateMaterialMaster20260620120000 implements MigrationInterface {
  name = 'CreateMaterialMaster20260620120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('mm_material'))) {
      await queryRunner.query(`
        CREATE TABLE "mm_material" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          "part_number"     character varying(60) NOT NULL,
          "description"     character varying(255) NOT NULL,
          "item_type"       character varying(16) NOT NULL DEFAULT 'PURCHASED',
          "category"        character varying(80),
          "base_uom"        character varying(16) NOT NULL DEFAULT 'EA',
          "make_buy"        character varying(8) NOT NULL DEFAULT 'BUY',
          "lifecycle"       character varying(16) NOT NULL DEFAULT 'DRAFT',
          "standard_cost"   double precision NOT NULL DEFAULT 0,
          "currency"        character varying(3) NOT NULL DEFAULT 'USD',
          "weight"          double precision,
          "weight_uom"      character varying(8) NOT NULL DEFAULT 'kg',
          "notes"           text,
          "metadata"        text,
          "activated_at"    TIMESTAMP,
          "obsoleted_at"    TIMESTAMP,
          CONSTRAINT "PK_mm_material" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_mm_material_scope_number" ON "mm_material" ("tenant_id", "plant_id", "part_number")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_mm_material_scope_status" ON "mm_material" ("tenant_id", "plant_id", "lifecycle")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_mm_material_scope_type" ON "mm_material" ("tenant_id", "plant_id", "item_type")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mm_material_part_number" ON "mm_material" ("part_number")`,
      );
    }

    if (!(await queryRunner.hasTable('mm_avl'))) {
      await queryRunner.query(`
        CREATE TABLE "mm_avl" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          "material_id"     uuid NOT NULL,
          "manufacturer"    character varying(160) NOT NULL,
          "mpn"             character varying(120) NOT NULL,
          "status"          character varying(16) NOT NULL DEFAULT 'PENDING',
          "preference"      integer NOT NULL DEFAULT 1,
          "lead_time_days"  integer,
          "notes"           text,
          CONSTRAINT "PK_mm_avl" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_mm_avl_material" ON "mm_avl" ("tenant_id", "material_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mm_avl_material_id" ON "mm_avl" ("material_id")`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_mm_avl_material_mpn" ON "mm_avl" ("material_id", "manufacturer", "mpn")`,
      );
    }

    if (!(await queryRunner.hasTable('mm_material_alt'))) {
      await queryRunner.query(`
        CREATE TABLE "mm_material_alt" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          "material_id"      uuid NOT NULL,
          "alt_material_id"  uuid NOT NULL,
          "type"             character varying(16) NOT NULL DEFAULT 'ALTERNATE',
          "bidirectional"    boolean NOT NULL DEFAULT true,
          "ratio"            double precision NOT NULL DEFAULT 1,
          "notes"            text,
          CONSTRAINT "PK_mm_material_alt" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_mm_alt_material" ON "mm_material_alt" ("tenant_id", "material_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mm_alt_material_id" ON "mm_material_alt" ("material_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mm_alt_alt_material_id" ON "mm_material_alt" ("alt_material_id")`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_mm_alt_pair" ON "mm_material_alt" ("material_id", "alt_material_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('mm_material_alt')) {
      await queryRunner.query(`DROP TABLE "mm_material_alt"`);
    }
    if (await queryRunner.hasTable('mm_avl')) {
      await queryRunner.query(`DROP TABLE "mm_avl"`);
    }
    if (await queryRunner.hasTable('mm_material')) {
      await queryRunner.query(`DROP TABLE "mm_material"`);
    }
  }
}
