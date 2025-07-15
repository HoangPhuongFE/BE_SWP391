-- CreateIndex
CREATE INDEX `Appointment_status_created_at_idx` ON `Appointment`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `Appointment_service_id_user_id_idx` ON `Appointment`(`service_id`, `user_id`);

-- CreateIndex
CREATE INDEX `Appointment_user_id_service_id_start_time_end_time_idx` ON `Appointment`(`user_id`, `service_id`, `start_time`, `end_time`);

-- CreateIndex
CREATE INDEX `Feedback_status_created_at_idx` ON `Feedback`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `MenstrualCycle_start_date_idx` ON `MenstrualCycle`(`start_date`);

-- CreateIndex
CREATE INDEX `Payment_status_created_at_payment_method_idx` ON `Payment`(`status`, `created_at`, `payment_method`);

-- CreateIndex
CREATE INDEX `Question_status_category_consultant_id_idx` ON `Question`(`status`, `category`, `consultant_id`);

-- CreateIndex
CREATE INDEX `TestResult_status_created_at_idx` ON `TestResult`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `User_role_is_active_created_at_idx` ON `User`(`role`, `is_active`, `created_at`);

-- RenameIndex
ALTER TABLE `appointment` RENAME INDEX `Appointment_consultant_id_fkey` TO `Appointment_consultant_id_idx`;
