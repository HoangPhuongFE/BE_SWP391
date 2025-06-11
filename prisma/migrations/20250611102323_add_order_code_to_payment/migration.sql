/*
  Warnings:

  - A unique constraint covering the columns `[order_code]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `order_code` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `appointment` ADD COLUMN `service_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `order_code` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Payment_order_code_key` ON `Payment`(`order_code`);

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `Service`(`service_id`) ON DELETE SET NULL ON UPDATE CASCADE;
