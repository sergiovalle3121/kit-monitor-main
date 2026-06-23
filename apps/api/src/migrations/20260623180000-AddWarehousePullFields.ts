import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Campos de PULL sobre `warehouse_tasks` (monitor de surtido nativo). Totalmente
 * aditivo: todas las columnas son nullable o traen default, así que las tareas
 * existentes no se rompen. Idempotente (salta si `synchronize` ya las creó).
 */
export class AddWarehousePullFields20260623180000 implements MigrationInterface {
  name = 'AddWarehousePullFields20260623180000';

  private readonly cols: Array<{ name: string; ddl: string }> = [
    { name: 'project', ddl: `ADD "project" character varying(120)` },
    { name: 'requestor', ddl: `ADD "requestor" character varying(120)` },
    { name: 'urgent', ddl: `ADD "urgent" boolean NOT NULL DEFAULT false` },
    { name: 'touches', ddl: `ADD "touches" integer NOT NULL DEFAULT 0` },
    { name: 'slaMinutes', ddl: `ADD "slaMinutes" integer` },
    { name: 'deliveredAt', ddl: `ADD "deliveredAt" TIMESTAMP` },
    { name: 'canceledAt', ddl: `ADD "canceledAt" TIMESTAMP` },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('warehouse_tasks'))) return;
    for (const c of this.cols) {
      if (!(await queryRunner.hasColumn('warehouse_tasks', c.name))) {
        await queryRunner.query(`ALTER TABLE "warehouse_tasks" ${c.ddl}`);
      }
    }
    // Índice de proyecto para el filtro/analítica del monitor.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_warehouse_tasks_project" ON "warehouse_tasks" ("project")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('warehouse_tasks'))) return;
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_warehouse_tasks_project"`);
    for (const c of [...this.cols].reverse()) {
      if (await queryRunner.hasColumn('warehouse_tasks', c.name)) {
        await queryRunner.query(`ALTER TABLE "warehouse_tasks" DROP COLUMN "${c.name}"`);
      }
    }
  }
}
