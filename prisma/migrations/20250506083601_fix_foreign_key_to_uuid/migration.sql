/*
  Warnings:

  - The primary key for the `refreshtoken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `student` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE `refreshtoken` DROP FOREIGN KEY `RefreshToken_userId_fkey`;

-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_studentId_fkey`;

-- DropIndex
DROP INDEX `RefreshToken_userId_fkey` ON `refreshtoken`;

-- AlterTable
ALTER TABLE `refreshtoken` DROP PRIMARY KEY,
    MODIFY `id` CHAR(36) NOT NULL,
    MODIFY `userId` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `student` DROP PRIMARY KEY,
    MODIFY `id` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `user` DROP PRIMARY KEY,
    MODIFY `id` CHAR(36) NOT NULL,
    MODIFY `studentId` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
