-- AlterTable
ALTER TABLE `Complaint` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Organization` ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `blockReason` VARCHAR(512) NULL,
    ADD COLUMN `blockedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Project` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Purchase` ADD COLUMN `downPercent` INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN `months` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `planType` ENUM('FULL', 'INSTALLMENT') NOT NULL DEFAULT 'FULL',
    ADD COLUMN `reservationUntil` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `blockReason` VARCHAR(512) NULL;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseId` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paidAt` DATETIME(3) NULL,
    `method` VARCHAR(32) NULL,
    `reference` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_status_dueDate_idx`(`status`, `dueDate`),
    UNIQUE INDEX `Payment_purchaseId_seq_key`(`purchaseId`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `Purchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
