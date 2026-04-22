import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class LedgerEventTable1713000000000 implements MigrationInterface {
    name = 'LedgerEventTable1713000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "ledger_events",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    generationStrategy: "uuid",
                    default: "uuid_generate_v4()"
                },
                {
                    name: "timestamp",
                    type: "timestamp with time zone",
                    default: "now()"
                },
                {
                    name: "actorId",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "actorName",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "domain",
                    type: "varchar"
                },
                {
                    name: "action",
                    type: "varchar"
                },
                {
                    name: "referenceType",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "referenceId",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "plant",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "warehouse",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "line",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "shift",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "customer",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "program",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "model",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "workOrder",
                    type: "varchar",
                    isNullable: true
                },
                {
                    name: "context",
                    type: "jsonb",
                    isNullable: true,
                    default: "'{}'"
                },
                {
                    name: "transaction",
                    type: "jsonb",
                    isNullable: true,
                    default: "'{}'"
                },
                {
                    name: "metadata",
                    type: "jsonb",
                    isNullable: true,
                    default: "'{}'"
                }
            ]
        }), true);

        // Indexes for fast lookups
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_REF_TYPE",
            columnNames: ["referenceType"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_REF_ID",
            columnNames: ["referenceId"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_PLANT",
            columnNames: ["plant"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_WAREHOUSE",
            columnNames: ["warehouse"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_LINE",
            columnNames: ["line"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_CUSTOMER",
            columnNames: ["customer"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_PROGRAM",
            columnNames: ["program"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_MODEL",
            columnNames: ["model"]
        }));
        await queryRunner.createIndex("ledger_events", new TableIndex({
            name: "IDX_LEDGER_WORK_ORDER",
            columnNames: ["workOrder"]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("ledger_events");
    }
}
