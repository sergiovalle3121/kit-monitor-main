import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class LedgerEventTable1713000000000 implements MigrationInterface {
  name = 'LedgerEventTable1713000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'ledger_events';

    const requiredColumns: TableColumn[] = [
      new TableColumn({
        name: 'id',
        type: 'uuid',
        isPrimary: true,
        generationStrategy: 'uuid',
        default: 'uuid_generate_v4()',
      }),
      new TableColumn({
        name: 'timestamp',
        type: 'timestamp with time zone',
        default: 'now()',
      }),
      new TableColumn({ name: 'actorId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'actorName', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'domain', type: 'varchar' }),
      new TableColumn({ name: 'action', type: 'varchar' }),
      new TableColumn({
        name: 'referenceType',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'referenceId',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({ name: 'plant', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'warehouse', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'line', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'shift', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'customer', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'program', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'model', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'workOrder', type: 'varchar', isNullable: true }),
      new TableColumn({
        name: 'context',
        type: 'jsonb',
        isNullable: true,
        default: "'{}'",
      }),
      new TableColumn({
        name: 'transaction',
        type: 'jsonb',
        isNullable: true,
        default: "'{}'",
      }),
      new TableColumn({
        name: 'metadata',
        type: 'jsonb',
        isNullable: true,
        default: "'{}'",
      }),
    ];

    if (!(await queryRunner.hasTable(tableName))) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: requiredColumns,
        }),
        true,
      );
    }

    // Railway/partial-state safety: if table already existed, backfill missing columns.
    for (const column of requiredColumns) {
      if (!(await queryRunner.hasColumn(tableName, column.name))) {
        await queryRunner.addColumn(tableName, column);
      }
    }

    const desiredIndexes: Array<{ name: string; column: string }> = [
      { name: 'IDX_LEDGER_REF_TYPE', column: 'referenceType' },
      { name: 'IDX_LEDGER_REF_ID', column: 'referenceId' },
      { name: 'IDX_LEDGER_PLANT', column: 'plant' },
      { name: 'IDX_LEDGER_WAREHOUSE', column: 'warehouse' },
      { name: 'IDX_LEDGER_LINE', column: 'line' },
      { name: 'IDX_LEDGER_CUSTOMER', column: 'customer' },
      { name: 'IDX_LEDGER_PROGRAM', column: 'program' },
      { name: 'IDX_LEDGER_MODEL', column: 'model' },
      { name: 'IDX_LEDGER_WORK_ORDER', column: 'workOrder' },
    ];

    for (const index of desiredIndexes) {
      if (!(await queryRunner.hasColumn(tableName, index.column))) {
        continue;
      }

      const table = await queryRunner.getTable(tableName);
      if (!table?.indices.some((existing) => existing.name === index.name)) {
        await queryRunner.createIndex(
          tableName,
          new TableIndex({
            name: index.name,
            columnNames: [index.column],
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ledger_events')) {
      await queryRunner.dropTable('ledger_events');
    }
  }
}
