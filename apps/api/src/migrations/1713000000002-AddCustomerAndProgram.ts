import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddCustomerAndProgram1713000000002 implements MigrationInterface {
    name = 'AddCustomerAndProgram1713000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Idempotente: estas tablas (plans/bom_items) existen en prod desde antes
        // (creadas por synchronize), así que guardamos cada add/createIndex para que
        // un `migration:run` futuro no falle por columnas/índices ya presentes.
        const addColIfMissing = async (table: string, column: TableColumn) => {
            if (await queryRunner.hasColumn(table, column.name)) return;
            await queryRunner.addColumn(table, column);
        };

        await addColIfMissing("plans", new TableColumn({ name: "customer", type: "varchar", isNullable: true }));
        await addColIfMissing("plans", new TableColumn({ name: "program", type: "varchar", isNullable: true }));
        await addColIfMissing("bom_items", new TableColumn({ name: "customer", type: "varchar", isNullable: true }));
        await addColIfMissing("bom_items", new TableColumn({ name: "program", type: "varchar", isNullable: true }));

        const bomItems = await queryRunner.getTable("bom_items");
        const hasIndex = (name: string) => !!bomItems?.indices.find((i) => i.name === name);
        if (!hasIndex("IDX_BOM_CUSTOMER")) {
            await queryRunner.createIndex("bom_items", new TableIndex({ name: "IDX_BOM_CUSTOMER", columnNames: ["customer"] }));
        }
        if (!hasIndex("IDX_BOM_PROGRAM")) {
            await queryRunner.createIndex("bom_items", new TableIndex({ name: "IDX_BOM_PROGRAM", columnNames: ["program"] }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("bom_items", "IDX_BOM_PROGRAM");
        await queryRunner.dropIndex("bom_items", "IDX_BOM_CUSTOMER");
        
        await queryRunner.dropColumn("bom_items", "program");
        await queryRunner.dropColumn("bom_items", "customer");
        
        await queryRunner.dropColumn("plans", "program");
        await queryRunner.dropColumn("plans", "customer");
    }
}
