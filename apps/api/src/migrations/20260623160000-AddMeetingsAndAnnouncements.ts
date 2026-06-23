import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reuniones programadas (`meetings`) y canales de anuncios
 * (`conversations.announcement`). Idempotente (se salta lo que ya exista).
 */
export class AddMeetingsAndAnnouncements20260623160000
  implements MigrationInterface
{
  name = 'AddMeetingsAndAnnouncements20260623160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('conversations', 'announcement'))) {
      await queryRunner.query(
        `ALTER TABLE "conversations" ADD COLUMN "announcement" boolean NOT NULL DEFAULT false`,
      );
    }

    if (!(await queryRunner.hasTable('meetings'))) {
      await queryRunner.query(`
        CREATE TABLE "meetings" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "conversation_id" uuid NOT NULL,
          "created_by_id" uuid NOT NULL,
          "title" varchar(160) NOT NULL,
          "start_at" TIMESTAMP WITH TIME ZONE NOT NULL,
          "duration_min" integer NOT NULL DEFAULT 30,
          "recurrence" varchar(12) NOT NULL DEFAULT 'none',
          "reminded_at" TIMESTAMP WITH TIME ZONE,
          "canceled_at" TIMESTAMP WITH TIME ZONE,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_meetings" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_meetings_conversation" ON "meetings" ("conversation_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_meetings_start_at" ON "meetings" ("start_at")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "meetings"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "announcement"`,
    );
  }
}
