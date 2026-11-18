import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImagesToChat1778051600000 implements MigrationInterface {
    name = 'AddImagesToChat1778051600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "images" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "images"`);
    }
}
