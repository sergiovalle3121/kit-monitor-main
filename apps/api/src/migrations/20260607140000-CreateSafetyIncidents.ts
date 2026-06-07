import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `safety_incidents` — EHS safety / environmental incidents.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateSafetyIncidents20260607140000 implements MigrationInterface {
  name = 'CreateSafetyIncidents20260607140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('safety_incidents')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "safety_incidents" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"         character varying(36),
        "organization_id"   character varying(36),
        "plant_id"          character varying(36),
        "folio"             character varying(32),
        "title"             character varying(200) NOT NULL,
        "description"       text,
        "type"              character varying(20) NOT NULL DEFAULT 'NEAR_MISS',
        "severity"          character varying(12) NOT NULL DEFAULT 'LOW',
        "status"            character varying(16) NOT NULL DEFAULT 'REPORTED',
        "area"              character varying(120),
        "location"          character varying(160),
        "program_id"        character varying(64),
        "reported_by"       character varying(200),
        "injured_person"    character varying(160),
        "lost_days"         integer NOT NULL DEFAULT 0,
        "root_cause"        text,
        "corrective_action" text,
        "occurred_at"       TIMESTAMP,
        "investigated_at"   TIMESTAMP,
        "closed_at"         TIMESTAMP,
        "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"        TIMESTAMP,
        "created_by"        character varying(255),
        CONSTRAINT "PK_safety_incidents" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_incident_scope_status" ON "safety_incidents" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_safety_incidents_folio" ON "safety_incidents" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_safety_incidents_program" ON "safety_incidents" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('safety_incidents')) {
      await queryRunner.query(`DROP TABLE "safety_incidents"`);
    }
  }
}
