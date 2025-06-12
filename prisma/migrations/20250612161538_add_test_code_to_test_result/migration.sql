/*
  Warnings:

  - A unique constraint covering the columns `[test_code]` on the table `TestResult` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `test_code` to the `TestResult` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `testresult` ADD COLUMN `test_code` VARCHAR(36) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `TestResult_test_code_key` ON `TestResult`(`test_code`);
