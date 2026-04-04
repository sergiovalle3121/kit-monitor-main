import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBomVisualFields20260404120000 implements MigrationInterface {
  name = 'AddBomVisualFields20260404120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('bom_items', [
      new TableColumn({
        name: 'imageUrl',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'specUrl',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'hasImage',
        type:
          queryRunner.connection.options.type === 'postgres'
            ? 'boolean'
            : 'integer',
        default: queryRunner.connection.options.type === 'postgres' ? false : 0,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('bom_items', 'hasImage');
    await queryRunner.dropColumn('bom_items', 'specUrl');
    await queryRunner.dropColumn('bom_items', 'imageUrl');
  }
}
