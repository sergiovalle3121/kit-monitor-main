import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCancellationRequests20260405170000 implements MigrationInterface {
  name = 'CreateCancellationRequests20260405170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cancellation_requests" (
        "id" SERIAL NOT NULL,
        "publication_id" integer NOT NULL,
        "kit_id" integer NOT NULL,
        "requested_by" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "responded_at" TIMESTAMP,
        "expires_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_cancellation_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "cancellation_requests"
      ADD CONSTRAINT "FK_cancellation_requests_publication"
      FOREIGN KEY ("publication_id") REFERENCES "plans"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "cancellation_requests"
      ADD CONSTRAINT "FK_cancellation_requests_kit"
      FOREIGN KEY ("kit_id") REFERENCES "kits"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cancellation_requests_status"
      ON "cancellation_requests" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cancellation_requests_kit_status"
      ON "cancellation_requests" ("kit_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_cancellation_requests_kit_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_cancellation_requests_status"');
    await queryRunner.query('ALTER TABLE "cancellation_requests" DROP CONSTRAINT IF EXISTS "FK_cancellation_requests_kit"');
    await queryRunner.query('ALTER TABLE "cancellation_requests" DROP CONSTRAINT IF EXISTS "FK_cancellation_requests_publication"');
    await queryRunner.query('DROP TABLE IF EXISTS "cancellation_requests"');
  }
}
