import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1714972800000 implements MigrationInterface {
    name = 'InitialMigration1714972800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "chat_messages" (
                "id" SERIAL NOT NULL, 
                "sessionId" varchar(255) NOT NULL, 
                "role" varchar(50) NOT NULL, 
                "content" text NOT NULL, 
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_563db377f0c1374567115856488" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "chat_messages"`);
    }

}
