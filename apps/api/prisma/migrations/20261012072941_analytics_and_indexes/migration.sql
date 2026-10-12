-- DropIndex
DROP INDEX `Certificate_status_idx` ON `Certificate`;

-- DropIndex
DROP INDEX `Complaint_status_idx` ON `Complaint`;

-- CreateTable
CREATE TABLE `ActivityEvent` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(48) NOT NULL,
    `projectId` VARCHAR(32) NULL,
    `userId` VARCHAR(32) NULL,
    `sessionId` VARCHAR(64) NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityEvent_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `ActivityEvent_projectId_type_createdAt_idx`(`projectId`, `type`, `createdAt`),
    INDEX `ActivityEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_action_createdAt_idx` ON `AuditLog`(`action`, `createdAt`);

-- CreateIndex
CREATE INDEX `Certificate_status_validUntil_idx` ON `Certificate`(`status`, `validUntil`);

-- CreateIndex
CREATE INDEX `Complaint_status_createdAt_idx` ON `Complaint`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `Document_status_createdAt_idx` ON `Document`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `Notification_userId_createdAt_idx` ON `Notification`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Project_published_featured_trustScore_idx` ON `Project`(`published`, `featured`, `trustScore`);

-- CreateIndex
CREATE INDEX `Project_published_createdAt_idx` ON `Project`(`published`, `createdAt`);

-- CreateIndex
CREATE INDEX `Purchase_projectId_status_idx` ON `Purchase`(`projectId`, `status`);

-- CreateIndex
CREATE INDEX `Purchase_status_createdAt_idx` ON `Purchase`(`status`, `createdAt`);

-- RenameIndex
ALTER TABLE `Complaint` RENAME INDEX `Complaint_projectId_fkey` TO `Complaint_projectId_idx`;

-- RenameIndex
ALTER TABLE `Purchase` RENAME INDEX `Purchase_buyerOrgId_fkey` TO `Purchase_buyerOrgId_idx`;
