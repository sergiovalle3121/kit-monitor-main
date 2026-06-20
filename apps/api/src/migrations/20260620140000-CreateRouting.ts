import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the ROUTING tables:
 *   - rt_routing            — routing header per assembly material + revision
 *   - rt_operation          — ordered operations (work center, standard times)
 *   - rt_operation_material — BOM↔routing bridge (materials consumed per op)
 *
 * Fully additive: brand-new prefixed tables (coexist with the legacy
 * `process_steps` routing), every column nullable or defaulted. Idempotent
 * (guarded by hasTable; skips when `synchronize` already created them).
 */
export class CreateRouting20260620140000 implements MigrationInterface {
  name = 'CreateRouting20260620140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('rt_routing'))) {
      await queryRunner.query(`
        CREATE TABLE "rt_routing" (
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
          "name"            character varying(160),
          "notes"           text,
          "metadata"        text,
          CONSTRAINT "PK_rt_routing" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_rt_routing_scope_material_rev" ON "rt_routing" ("tenant_id", "plant_id", "material_id", "revision")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_rt_routing_scope_status" ON "rt_routing" ("tenant_id", "plant_id", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_rt_routing_material_id" ON "rt_routing" ("material_id")`,
      );
    }

    if (!(await queryRunner.hasTable('rt_operation'))) {
      await queryRunner.query(`
        CREATE TABLE "rt_operation" (
          "id"                    uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"             character varying(36),
          "organization_id"       character varying(36),
          "plant_id"              character varying(36),
          "created_at"            TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"            TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"            TIMESTAMP,
          "created_by"            character varying(255),
          "routing_id"            uuid NOT NULL,
          "sequence"              integer NOT NULL DEFAULT 10,
          "name"                  character varying(160) NOT NULL,
          "work_center"           character varying(120),
          "setup_time_min"        double precision NOT NULL DEFAULT 0,
          "run_time_per_unit_min" double precision NOT NULL DEFAULT 0,
          "description"           text,
          "visual_aid_ref"        character varying(120),
          CONSTRAINT "PK_rt_operation" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_rt_operation_routing" ON "rt_operation" ("tenant_id", "routing_id")`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_rt_operation_seq" ON "rt_operation" ("routing_id", "sequence")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_rt_operation_routing_id" ON "rt_operation" ("routing_id")`,
      );
    }

    if (!(await queryRunner.hasTable('rt_operation_material'))) {
      await queryRunner.query(`
        CREATE TABLE "rt_operation_material" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          "operation_id"    uuid NOT NULL,
          "material_id"     uuid NOT NULL,
          "bom_line_id"     uuid,
          "qty_per_unit"    double precision NOT NULL DEFAULT 1,
          "uom"             character varying(16) NOT NULL DEFAULT 'EA',
          "notes"           text,
          CONSTRAINT "PK_rt_operation_material" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_rt_opmat_operation" ON "rt_operation_material" ("tenant_id", "operation_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_rt_opmat_material" ON "rt_operation_material" ("tenant_id", "material_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_rt_opmat_operation_id" ON "rt_operation_material" ("operation_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_rt_opmat_material_id" ON "rt_operation_material" ("material_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('rt_operation_material')) {
      await queryRunner.query(`DROP TABLE "rt_operation_material"`);
    }
    if (await queryRunner.hasTable('rt_operation')) {
      await queryRunner.query(`DROP TABLE "rt_operation"`);
    }
    if (await queryRunner.hasTable('rt_routing')) {
      await queryRunner.query(`DROP TABLE "rt_routing"`);
    }
  }
}
