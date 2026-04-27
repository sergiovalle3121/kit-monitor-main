import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: AddTenantIdToCriticalTables
 *
 * Adds a `tenant_id` column to the two highest-value business tables:
 *   • plans          — Production work orders (primary planning entity)
 *   • production_wip — Active shopfloor WIP records
 *
 * Rationale:
 *   AXOS OS currently uses scope-based organisational isolation (buildingId /
 *   program / line on the User.scopes JSONB). This migration introduces an
 *   explicit `tenant_id` column to support future hard multi-tenant isolation
 *   at the database row level via the TenantSubscriber.
 *
 *   For backward-compatibility all existing rows receive `tenant_id = 'default'`.
 *   The column is NULLABLE to allow gradual population in mixed deployments.
 *
 * To extend tenant_id to additional tables repeat the same pattern:
 *   await this.addTenantId(queryRunner, 'table_name');
 */
export class AddTenantIdToCriticalTables20260424120000 implements MigrationInterface {
  name = 'AddTenantIdToCriticalTables20260424120000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.addTenantId(queryRunner, 'plans');
    await this.addTenantId(queryRunner, 'production_wip');
    await this.addTenantId(queryRunner, 'kits');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTenantId(queryRunner, 'plans');
    await this.dropTenantId(queryRunner, 'production_wip');
    await this.dropTenantId(queryRunner, 'kits');
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async addTenantId(queryRunner: QueryRunner, table: string): Promise<void> {
    const exists = await this.columnExists(queryRunner, table, 'tenant_id');
    if (exists) return;

    await queryRunner.addColumn(
      table,
      new TableColumn({
        name:       'tenant_id',
        type:       'varchar',
        length:     '100',
        isNullable: true,
        default:    `'default'`,
        comment:    'Organisational tenant partition. Empty = unrestricted (legacy).',
      }),
    );

    // Backfill existing rows
    await queryRunner.query(
      `UPDATE "${table}" SET tenant_id = 'default' WHERE tenant_id IS NULL`,
    );

    // Index for efficient tenant-scoped queries
    await queryRunner.createIndex(
      table,
      new TableIndex({
        name:        `IDX_${table}_tenant_id`,
        columnNames: ['tenant_id'],
      }),
    );
  }

  private async dropTenantId(queryRunner: QueryRunner, table: string): Promise<void> {
    const exists = await this.columnExists(queryRunner, table, 'tenant_id');
    if (!exists) return;

    await queryRunner.dropIndex(table, `IDX_${table}_tenant_id`);
    await queryRunner.dropColumn(table, 'tenant_id');
  }

  private async columnExists(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const tableInfo = await queryRunner.getTable(table);
    return !!tableInfo?.findColumnByName(column);
  }
}
