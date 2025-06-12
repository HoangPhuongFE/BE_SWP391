/*
  Warnings:

  - A unique constraint covering the columns `[schedule_id]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `appointment` ADD COLUMN `schedule_id` CHAR(36) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Appointment_schedule_id_key` ON `Appointment`(`schedule_id`);

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `Schedule`(`schedule_id`) ON DELETE SET NULL ON UPDATE CASCADE;
