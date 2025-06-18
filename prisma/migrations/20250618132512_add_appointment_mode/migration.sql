-- AlterTable
ALTER TABLE `appointment` ADD COLUMN `mode` ENUM('AT_HOME', 'AT_CLINIC') NULL;
