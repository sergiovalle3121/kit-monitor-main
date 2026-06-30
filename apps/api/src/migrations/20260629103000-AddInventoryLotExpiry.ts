import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lot expiry visibility for receiving and inventory. Additive and idempotent:
 * both columns are nullable, and synchronize may already have created them.
 */
export class AddInventoryLotExpiry20260629103000 implements MigrationInterface {
  name = 'AddInventoryLotExpiry20260629103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('receiving_events')) {
      if (!(await queryRunner.hasColumn('receiving_events', 'expires_at'))) {
        await queryRunner.query(
          `ALTER TABLE "receiving_events" ADD COLUMN "expires_at" TIMESTAMP`,
        );
      }
    }

    if (await queryRunner.hasTable('inventory_positions')) {
      if (!(await queryRunner.hasColumn('inventory_positions', 'expires_at'))) {
        await queryRunner.query(
          `ALTER TABLE "inventory_positions" ADD COLUMN "expires_at" TIMESTAMP`,
        );
      }
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_inventory_positions_expires_at" ON "inventory_positions" ("expires_at")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inventory_positions')) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_inventory_positions_expires_at"`,
      );
      if (await queryRunner.hasColumn('inventory_positions', 'expires_at')) {
        await queryRunner.query(
          `ALTER TABLE "inventory_positions" DROP COLUMN "expires_at"`,
        );
      }
    }

    if (await queryRunner.hasTable('receiving_events')) {
      if (await queryRunner.hasColumn('receiving_events', 'expires_at')) {
        await queryRunner.query(
          `ALTER TABLE "receiving_events" DROP COLUMN "expires_at"`,
        );
      }
    }
  }
}
