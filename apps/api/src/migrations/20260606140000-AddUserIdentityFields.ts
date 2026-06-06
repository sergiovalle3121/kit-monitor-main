import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds per-user identity + account-lifecycle fields to `users` so the backend
 * can be the single source of truth for users (display name, job position,
 * approval status). Idempotent — synchronize may have created some columns.
 */
export class AddUserIdentityFields20260606140000 implements MigrationInterface {
  name = 'AddUserIdentityFields20260606140000';

  private async addColumn(
    qr: QueryRunner,
    table: string,
    column: string,
    ddl: string,
  ): Promise<void> {
    if (!(await qr.hasColumn(table, column))) {
      await qr.query(`ALTER TABLE "${table}" ADD "${column}" ${ddl}`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumn(
      queryRunner,
      'users',
      'name',
      'character varying(160)',
    );
    await this.addColumn(
      queryRunner,
      'users',
      'position',
      'character varying(80)',
    );
    await this.addColumn(
      queryRunner,
      'users',
      'status',
      `character varying(16) NOT NULL DEFAULT 'active'`,
    );
    await this.addColumn(queryRunner, 'users', 'approvedAt', 'TIMESTAMP');
    await this.addColumn(
      queryRunner,
      'users',
      'approvedBy',
      'character varying(160)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'approvedBy',
      'approvedAt',
      'status',
      'position',
      'name',
    ]) {
      if (await queryRunner.hasColumn('users', column)) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "${column}"`);
      }
    }
  }
}
