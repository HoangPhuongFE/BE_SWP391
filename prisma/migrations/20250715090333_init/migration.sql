-- AlterTable
ALTER TABLE `appointment` MODIFY `status` ENUM('Pending', 'Confirmed', 'InProgress', 'SampleCollected', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending';

-- AlterTable
ALTER TABLE `appointmentstatushistory` MODIFY `status` ENUM('Pending', 'Confirmed', 'InProgress', 'SampleCollected', 'Completed', 'Cancelled') NOT NULL;
