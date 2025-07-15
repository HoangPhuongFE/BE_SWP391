-- CreateIndex
CREATE INDEX `Schedule_consultant_id_start_time_end_time_idx` ON `Schedule`(`consultant_id`, `start_time`, `end_time`);
