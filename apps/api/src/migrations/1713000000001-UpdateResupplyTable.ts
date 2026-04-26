import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateResupplyTable1713000000001 implements MigrationInterface {
  name = 'UpdateResupplyTable1713000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasResuppliesTable = await queryRunner.hasTable('resupplies');
    if (!hasResuppliesTable) return;

    const columnsToAdd: TableColumn[] = [
      new TableColumn({
        name: 'priority',
        type: 'varchar',
        default: "'medium'",
      }),
      new TableColumn({
        name: 'ownerId',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ownerName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'requestedAt',
        type: 'timestamp',
        default: 'now()',
      }),
      new TableColumn({
        name: 'acknowledgedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'pickStartedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'pickCompletedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'deliveredAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'confirmedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'escalatedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'cancelledAt',
        type: 'timestamp',
        isNullable: true,
      }),
    ];

    const missingColumns: TableColumn[] = [];
    for (const column of columnsToAdd) {
      const hasColumn = await queryRunner.hasColumn('resupplies', column.name);
      if (!hasColumn) {
        missingColumns.push(column);
      }
    }

    if (missingColumns.length > 0) {
      await queryRunner.addColumns('resupplies', missingColumns);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasResuppliesTable = await queryRunner.hasTable('resupplies');
    if (!hasResuppliesTable) return;

    const columnsToDrop = [
      'priority',
      'ownerId',
      'ownerName',
      'requestedAt',
      'acknowledgedAt',
      'pickStartedAt',
      'pickCompletedAt',
      'deliveredAt',
      'confirmedAt',
      'escalatedAt',
      'cancelledAt',
    ];

    const existingColumns: string[] = [];
    for (const columnName of columnsToDrop) {
      const hasColumn = await queryRunner.hasColumn('resupplies', columnName);
      if (hasColumn) {
        existingColumns.push(columnName);
      }
    }

    if (existingColumns.length > 0) {
      await queryRunner.dropColumns('resupplies', existingColumns);
    }
  }
}
