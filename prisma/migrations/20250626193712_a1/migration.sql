-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('Guest', 'Customer', 'Consultant', 'Staff', 'Manager', 'Admin', 'System') NOT NULL DEFAULT 'Customer';
