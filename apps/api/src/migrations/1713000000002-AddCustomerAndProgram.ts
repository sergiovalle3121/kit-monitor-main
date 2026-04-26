import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddCustomerAndProgram1713000000002 implements MigrationInterface {
  name = 'AddCustomerAndProgram1713000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to plans
    await queryRunner.addColumns('plans', [
      new TableColumn({
        name: 'customer',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'program',
        type: 'varchar',
        isNullable: true,
      }),
    ]);

    // Add columns to bom_items
    await queryRunner.addColumns('bom_items', [
      new TableColumn({
        name: 'customer',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'program',
        type: 'varchar',
        isNullable: true,
      }),
    ]);

    // Add indexes
    await queryRunner.createIndex(
      'bom_items',
      new TableIndex({
        name: 'IDX_BOM_CUSTOMER',
        columnNames: ['customer'],
      }),
    );
    await queryRunner.createIndex(
      'bom_items',
      new TableIndex({
        name: 'IDX_BOM_PROGRAM',
        columnNames: ['program'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('bom_items', 'IDX_BOM_PROGRAM');
    await queryRunner.dropIndex('bom_items', 'IDX_BOM_CUSTOMER');

    await queryRunner.dropColumn('bom_items', 'program');
    await queryRunner.dropColumn('bom_items', 'customer');

    await queryRunner.dropColumn('plans', 'program');
    await queryRunner.dropColumn('plans', 'customer');
  }
}
