import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `supplier_approved_parts` — the AVL (Approved Vendor List): which
 * supplier is approved to supply which part, with sourcing terms.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateSupplierApprovedParts20260623120000 implements MigrationInterface {
  name = 'CreateSupplierApprovedParts20260623120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('supplier_approved_parts')) return;

    await queryRunner.query(`
      CREATE TABLE "supplier_approved_parts" (
        "id"               SERIAL NOT NULL,
        "supplier_id"      integer NOT NULL,
        "part_number"      character varying(100) NOT NULL,
        "description"      character varying(200),
        "commodity"        character varying(80),
        "approval_status"  character varying(16) NOT NULL DEFAULT 'PENDING',
        "approved_at"      TIMESTAMP,
        "approved_by"      character varying(120),
        "unit_price"       double precision,
        "currency"         character varying(3) NOT NULL DEFAULT 'USD',
        "moq"              double precision,
        "lead_time_days"   integer,
        "notes"            text,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_supplier_approved_parts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_supplier_approved_parts_supplier_part" UNIQUE ("supplier_id", "part_number")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_supplier_approved_parts_supplier" ON "supplier_approved_parts" ("supplier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_supplier_approved_parts_part" ON "supplier_approved_parts" ("part_number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('supplier_approved_parts')) {
      await queryRunner.query(`DROP TABLE "supplier_approved_parts"`);
    }
  }
}
