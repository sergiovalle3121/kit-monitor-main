import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the MULTI-LEVEL BOM tables:
 *   - bom_node — BOM header per assembly material + revision
 *   - bom_line — component lines referencing the material master (mm_material)
 *
 * Fully additive: brand-new prefixed tables (do NOT collide with the legacy flat
 * BOM `bom_headers` / `bom_components` / `bom_items`), every column nullable or
 * defaulted. Idempotent (guarded by hasTable; skips when `synchronize` already
 * created them on Railway).
 */
export class CreateBomTree20260620130000 implements MigrationInterface {
  name = 'CreateBomTree20260620130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('bom_node'))) {
      await queryRunner.query(`
        CREATE TABLE "bom_node" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          "material_id"     uuid NOT NULL,
          "revision"        character varying(20) NOT NULL DEFAULT '1.0',
          "status"          character varying(16) NOT NULL DEFAULT 'DRAFT',
          "base_quantity"   double precision NOT NULL DEFAULT 1,
          "base_uom"        character varying(16) NOT NULL DEFAULT 'EA',
          "notes"           text,
          "metadata"        text,
          CONSTRAINT "PK_bom_node" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_bom_node_scope_material_rev" ON "bom_node" ("tenant_id", "plant_id", "material_id", "revision")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_bom_node_scope_status" ON "bom_node" ("tenant_id", "plant_id", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_bom_node_material_id" ON "bom_node" ("material_id")`,
      );
    }

    if (!(await queryRunner.hasTable('bom_line'))) {
      await queryRunner.query(`
        CREATE TABLE "bom_line" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          "bom_node_id"      uuid NOT NULL,
          "material_id"      uuid NOT NULL,
          "find_number"      character varying(12) NOT NULL DEFAULT '0010',
          "quantity"         double precision NOT NULL DEFAULT 1,
          "uom"              character varying(16) NOT NULL DEFAULT 'EA',
          "ref_des"          character varying(255),
          "item_category"    character varying(16) NOT NULL DEFAULT 'STANDARD',
          "scrap_pct"        double precision NOT NULL DEFAULT 0,
          "make_buy"         character varying(8),
          "phantom"          boolean NOT NULL DEFAULT false,
          "alternate_group"  character varying(40),
          "notes"            text,
          CONSTRAINT "PK_bom_line" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_bom_line_node" ON "bom_line" ("tenant_id", "bom_node_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_bom_line_material" ON "bom_line" ("tenant_id", "material_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_bom_line_node_id" ON "bom_line" ("bom_node_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_bom_line_material_id" ON "bom_line" ("material_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('bom_line')) {
      await queryRunner.query(`DROP TABLE "bom_line"`);
    }
    if (await queryRunner.hasTable('bom_node')) {
      await queryRunner.query(`DROP TABLE "bom_node"`);
    }
  }
}
