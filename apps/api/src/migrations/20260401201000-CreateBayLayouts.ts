import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBayLayouts20260401201000 implements MigrationInterface {
  name = "CreateBayLayouts20260401201000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bay_layouts" (
        "id" SERIAL NOT NULL,
        "model" character varying NOT NULL,
        "partNumber" character varying NOT NULL,
        "bahia" integer NOT NULL,
        CONSTRAINT "PK_bay_layouts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bay_layouts_model"
      ON "bay_layouts" ("model")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bay_layouts_model_partNumber_bahia"
      ON "bay_layouts" ("model", "partNumber", "bahia")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_bay_layouts_model_partNumber_bahia"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_bay_layouts_model"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "bay_layouts"
    `);
  }
}
