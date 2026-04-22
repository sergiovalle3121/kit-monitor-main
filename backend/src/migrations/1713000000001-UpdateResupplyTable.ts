import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UpdateResupplyTable1713000000001 implements MigrationInterface {
    name = 'UpdateResupplyTable1713000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns("resupplies", [
            new TableColumn({
                name: "priority",
                type: "varchar",
                default: "'medium'"
            }),
            new TableColumn({
                name: "ownerId",
                type: "varchar",
                isNullable: true
            }),
            new TableColumn({
                name: "ownerName",
                type: "varchar",
                isNullable: true
            }),
            new TableColumn({
                name: "requestedAt",
                type: "timestamp",
                default: "now()"
            }),
            new TableColumn({
                name: "acknowledgedAt",
                type: "timestamp",
                isNullable: true
            }),
            new TableColumn({
                name: "pickStartedAt",
                type: "timestamp",
                isNullable: true
            }),
            new TableColumn({
                name: "pickCompletedAt",
                type: "timestamp",
                isNullable: true
            }),
            new TableColumn({
                name: "deliveredAt",
                type: "timestamp",
                isNullable: true
            }),
            new TableColumn({
                name: "confirmedAt",
                type: "timestamp",
                isNullable: true
            }),
            new TableColumn({
                name: "escalatedAt",
                type: "timestamp",
                isNullable: true
            }),
            new TableColumn({
                name: "cancelledAt",
                type: "timestamp",
                isNullable: true
            })
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumns("resupplies", [
            "priority",
            "ownerId",
            "ownerName",
            "requestedAt",
            "acknowledgedAt",
            "pickStartedAt",
            "pickCompletedAt",
            "deliveredAt",
            "confirmedAt",
            "escalatedAt",
            "cancelledAt"
        ]);
    }
}
