-- DropIndex
DROP INDEX `Appointment_mode_idx` ON `appointment`;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `Appointment`(`appointment_id`) ON DELETE SET NULL ON UPDATE CASCADE;
