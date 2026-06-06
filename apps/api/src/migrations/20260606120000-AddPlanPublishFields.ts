import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanPublishFields20260606120000 implements MigrationInterface {
    name = 'AddPlanPublishFields20260606120000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Guarded: synchronize:true may have already created these in some environments.
        const hasPublishedAt = await queryRunner.hasColumn("plans", "publishedAt");
        if (!hasPublishedAt) {
            await queryRunner.query(`ALTER TABLE "plans" ADD "publishedAt" TIMESTAMP`);
        }

        const hasPublishedBy = await queryRunner.hasColumn("plans", "publishedBy");
        if (!hasPublishedBy) {
            await queryRunner.query(`ALTER TABLE "plans" ADD "publishedBy" character varying(120)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasPublishedBy = await queryRunner.hasColumn("plans", "publishedBy");
        if (hasPublishedBy) {
            await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "publishedBy"`);
        }

        const hasPublishedAt = await queryRunner.hasColumn("plans", "publishedAt");
        if (hasPublishedAt) {
            await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "publishedAt"`);
        }
    }
}
