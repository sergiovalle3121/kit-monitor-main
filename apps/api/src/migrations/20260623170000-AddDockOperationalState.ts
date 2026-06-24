import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Traffic (Tráfico) — operational state for the dock board (Tablero de andenes).
 * Adds the additive, nullable yard-cockpit columns `occupied_at` and
 * `loading_started_at` to `traffic_docks`. `occupied_at` starts the aging clock
 * when a door is taken (kept in sync by TrafficService.setDockStatus, which the
 * outbound transport assignment already calls); `loading_started_at` marks the
 * EN CARGA sub-state. Fully additive and idempotent (hasColumn guards); never
 * drops or narrows anything, and leaves the poka-yoke `status` column untouched.
 */
export class AddDockOperationalState20260623170000 implements MigrationInterface {
  name = 'AddDockOperationalState20260623170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('traffic_docks'))) return;
    const cols: { name: string; ddl: string }[] = [
      { name: 'occupied_at', ddl: 'TIMESTAMP' },
      { name: 'loading_started_at', ddl: 'TIMESTAMP' },
    ];
    for (const c of cols) {
      if (!(await queryRunner.hasColumn('traffic_docks', c.name))) {
        await queryRunner.query(
          `ALTER TABLE "traffic_docks" ADD COLUMN "${c.name}" ${c.ddl}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('traffic_docks'))) return;
    for (const name of ['loading_started_at', 'occupied_at']) {
      if (await queryRunner.hasColumn('traffic_docks', name)) {
        await queryRunner.query(`ALTER TABLE "traffic_docks" DROP COLUMN "${name}"`);
      }
    }
  }
}
