import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Additive, non-destructive: link a certification to a real hr_employees row.
 * Nullable so existing certs (name-only) keep working untouched. Guarded because
 * `synchronize: true` may already have created the column in some environments.
 */
export class AddCertificationEmployeeId20260623000000 implements MigrationInterface {
    name = 'AddCertificationEmployeeId20260623000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn("certifications", "employee_id");
        if (!hasColumn) {
            await queryRunner.query(`ALTER TABLE "certifications" ADD "employee_id" character varying(36)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn("certifications", "employee_id");
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE "certifications" DROP COLUMN "employee_id"`);
        }
    }
}
