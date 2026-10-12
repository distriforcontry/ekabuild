-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(16) NOT NULL,
    `phoneVerifiedAt` DATETIME(3) NULL,
    `email` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `pinfl` VARCHAR(14) NULL,
    `avatarUrl` VARCHAR(512) NULL,
    `role` ENUM('BUYER', 'DEVELOPER', 'INSPECTOR', 'ADMIN', 'SUPERADMIN') NOT NULL DEFAULT 'BUYER',
    `status` ENUM('ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `locale` VARCHAR(5) NOT NULL DEFAULT 'uz',
    `lastLoginAt` DATETIME(3) NULL,
    `organizationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_phone_key`(`phone`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `refreshTokenHash` VARCHAR(128) NOT NULL,
    `userAgent` VARCHAR(512) NULL,
    `ip` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('DEVELOPER', 'BUYER_COMPANY', 'INSPECTION_BODY') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(255) NULL,
    `tin` VARCHAR(9) NOT NULL,
    `director` VARCHAR(191) NULL,
    `phone` VARCHAR(32) NULL,
    `email` VARCHAR(191) NULL,
    `website` VARCHAR(255) NULL,
    `address` VARCHAR(512) NULL,
    `region` VARCHAR(128) NULL,
    `licenseNumber` VARCHAR(64) NULL,
    `logoUrl` VARCHAR(512) NULL,
    `description` TEXT NULL,
    `foundedYear` INTEGER NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectReason` VARCHAR(512) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organization_tin_key`(`tin`),
    INDEX `Organization_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tagline` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `type` ENUM('RESIDENTIAL', 'COMMERCIAL', 'MIXED', 'INDUSTRIAL') NOT NULL DEFAULT 'RESIDENTIAL',
    `status` ENUM('PLANNING', 'PERMITTED', 'UNDER_CONSTRUCTION', 'COMPLETED', 'COMMISSIONED', 'SUSPENDED') NOT NULL DEFAULT 'PLANNING',
    `developerId` VARCHAR(191) NOT NULL,
    `region` VARCHAR(128) NOT NULL,
    `district` VARCHAR(128) NULL,
    `address` VARCHAR(512) NOT NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `cadastreNumber` VARCHAR(64) NULL,
    `landArea` DOUBLE NULL,
    `totalArea` DOUBLE NULL,
    `floors` INTEGER NOT NULL DEFAULT 1,
    `sections` INTEGER NOT NULL DEFAULT 1,
    `unitsTotal` INTEGER NOT NULL DEFAULT 0,
    `priceFrom` DECIMAL(16, 2) NULL,
    `pricePerSqm` DECIMAL(16, 2) NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'UZS',
    `startDate` DATETIME(3) NULL,
    `plannedEndDate` DATETIME(3) NULL,
    `actualEndDate` DATETIME(3) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `coverUrl` VARCHAR(512) NULL,
    `gallery` JSON NULL,
    `massing` JSON NULL,
    `model3dId` VARCHAR(191) NULL,
    `packagePrice` DECIMAL(16, 2) NULL,
    `trustScore` INTEGER NOT NULL DEFAULT 0,
    `trustBreakdown` JSON NULL,
    `verificationStatus` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `published` BOOLEAN NOT NULL DEFAULT false,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `views` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Project_slug_key`(`slug`),
    UNIQUE INDEX `Project_model3dId_key`(`model3dId`),
    INDEX `Project_developerId_idx`(`developerId`),
    INDEX `Project_status_published_idx`(`status`, `published`),
    INDEX `Project_region_idx`(`region`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unit` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(32) NOT NULL,
    `section` INTEGER NOT NULL DEFAULT 1,
    `floor` INTEGER NOT NULL,
    `type` ENUM('APARTMENT', 'COMMERCIAL', 'OFFICE', 'PARKING', 'STORAGE') NOT NULL DEFAULT 'APARTMENT',
    `rooms` INTEGER NOT NULL DEFAULT 1,
    `area` DOUBLE NOT NULL,
    `price` DECIMAL(16, 2) NOT NULL,
    `status` ENUM('AVAILABLE', 'RESERVED', 'SOLD') NOT NULL DEFAULT 'AVAILABLE',
    `planUrl` VARCHAR(512) NULL,
    `features` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Unit_projectId_status_idx`(`projectId`, `status`),
    UNIQUE INDEX `Unit_projectId_section_number_key`(`projectId`, `section`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileObject` (
    `id` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(512) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mime` VARCHAR(128) NOT NULL,
    `size` INTEGER NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FileObject_storageKey_key`(`storageKey`),
    INDEX `FileObject_sha256_idx`(`sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `type` ENUM('BUILDING_PERMIT', 'LICENSE', 'EXPERTISE', 'CADASTRE_EXTRACT', 'LAND_ALLOTMENT', 'CONFORMITY_CERT', 'COMMISSIONING_ACT', 'DRAWING', 'MODEL_3D', 'FLOOR_PLAN', 'REGULATION', 'CONTRACT', 'PHOTO', 'OTHER') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `number` VARCHAR(128) NULL,
    `issuer` VARCHAR(255) NULL,
    `issuedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `access` ENUM('PUBLIC', 'BUYERS', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `fileId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Document_fileId_key`(`fileId`),
    INDEX `Document_projectId_type_idx`(`projectId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Certificate` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NULL,
    `type` ENUM('BUILDING_PERMIT', 'CONSTRUCTION_LICENSE', 'STATE_EXPERTISE', 'CONFORMITY', 'COMMISSIONING', 'FIRE_SAFETY', 'ENVIRONMENTAL') NOT NULL,
    `number` VARCHAR(128) NOT NULL,
    `issuer` VARCHAR(255) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `note` VARCHAR(512) NULL,
    `registryRef` VARCHAR(255) NULL,
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Certificate_code_key`(`code`),
    UNIQUE INDEX `Certificate_documentId_key`(`documentId`),
    INDEX `Certificate_projectId_idx`(`projectId`),
    INDEX `Certificate_status_idx`(`status`),
    UNIQUE INDEX `Certificate_type_number_key`(`type`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CadastreCheck` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `cadastreNumber` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `result` ENUM('MATCH', 'PARTIAL', 'MISMATCH', 'NOT_FOUND', 'ERROR') NOT NULL,
    `details` JSON NULL,
    `distanceM` DOUBLE NULL,
    `checkedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CadastreCheck_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inspection` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `inspectorId` VARCHAR(191) NOT NULL,
    `type` ENUM('SCHEDULED', 'UNSCHEDULED', 'FOUNDATION', 'FRAME', 'ENGINEERING', 'FINAL') NOT NULL,
    `result` ENUM('PASSED', 'ISSUES', 'FAILED') NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `summary` VARCHAR(512) NOT NULL,
    `notes` TEXT NULL,
    `violations` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Inspection_projectId_date_idx`(`projectId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InspectionFile` (
    `inspectionId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`inspectionId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressUpdate` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `phase` ENUM('CONSTRUCTION', 'POST_HANDOVER') NOT NULL DEFAULT 'CONSTRUCTION',
    `title` VARCHAR(255) NOT NULL,
    `body` TEXT NULL,
    `stage` VARCHAR(128) NULL,
    `percent` INTEGER NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProgressUpdate_projectId_date_idx`(`projectId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressMedia` (
    `progressId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`progressId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Purchase` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(32) NOT NULL,
    `kind` ENUM('UNIT', 'DOCUMENT_PACKAGE') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_SIGNATURES', 'SIGNED', 'PAID', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `projectId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NULL,
    `activeUnitLock` VARCHAR(64) NULL,
    `buyerId` VARCHAR(191) NOT NULL,
    `buyerOrgId` VARCHAR(191) NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'UZS',
    `paidAt` DATETIME(3) NULL,
    `note` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Purchase_number_key`(`number`),
    UNIQUE INDEX `Purchase_activeUnitLock_key`(`activeUnitLock`),
    INDEX `Purchase_buyerId_idx`(`buyerId`),
    INDEX `Purchase_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('UNIT', 'DOCUMENT_PACKAGE') NOT NULL,
    `body` LONGTEXT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ContractTemplate_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contract` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(32) NOT NULL,
    `purchaseId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `bodyHash` VARCHAR(64) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'PARTIALLY_SIGNED', 'SIGNED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `signedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Contract_number_key`(`number`),
    UNIQUE INDEX `Contract_purchaseId_key`(`purchaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Signature` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('BUYER', 'SELLER', 'WITNESS') NOT NULL,
    `method` ENUM('EIMZO', 'MOCK') NOT NULL,
    `pkcs7` LONGTEXT NOT NULL,
    `certSerial` VARCHAR(64) NULL,
    `signerName` VARCHAR(255) NULL,
    `signerTin` VARCHAR(14) NULL,
    `signerPinfl` VARCHAR(14) NULL,
    `certValidTo` DATETIME(3) NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `verifyDetail` JSON NULL,
    `signedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Signature_contractId_role_key`(`contractId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rule` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `code` VARCHAR(64) NULL,
    `summary` VARCHAR(512) NULL,
    `body` LONGTEXT NOT NULL,
    `sourceUrl` VARCHAR(512) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Rule_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Complaint` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `reporterId` VARCHAR(191) NULL,
    `contact` VARCHAR(191) NULL,
    `category` VARCHAR(64) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `resolution` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Complaint_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Favorite` (
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `projectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'DANGER') NOT NULL DEFAULT 'INFO',
    `title` VARCHAR(255) NOT NULL,
    `body` VARCHAR(1024) NULL,
    `link` VARCHAR(512) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_idx`(`userId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(64) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(64) NULL,
    `meta` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `prevHash` VARCHAR(64) NOT NULL,
    `hash` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuditLog_hash_key`(`hash`),
    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhoneOtp` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(16) NOT NULL,
    `purpose` ENUM('REGISTER', 'LOGIN', 'RESET') NOT NULL,
    `codeHash` VARCHAR(128) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhoneOtp_phone_purpose_createdAt_idx`(`phone`, `purpose`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportThread` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(255) NULL,
    `status` ENUM('OPEN', 'PENDING', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `userId` VARCHAR(191) NULL,
    `guestName` VARCHAR(128) NULL,
    `guestPhone` VARCHAR(32) NULL,
    `guestTokenHash` VARCHAR(128) NULL,
    `assignedToId` VARCHAR(191) NULL,
    `unreadForAgent` INTEGER NOT NULL DEFAULT 0,
    `unreadForUser` INTEGER NOT NULL DEFAULT 0,
    `firstResponseAt` DATETIME(3) NULL,
    `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SupportThread_guestTokenHash_key`(`guestTokenHash`),
    INDEX `SupportThread_status_lastMessageAt_idx`(`status`, `lastMessageAt`),
    INDEX `SupportThread_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportMessage` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `senderType` ENUM('USER', 'AGENT', 'SYSTEM') NOT NULL,
    `senderId` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupportMessage_threadId_createdAt_idx`(`threadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_developerId_fkey` FOREIGN KEY (`developerId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_model3dId_fkey` FOREIGN KEY (`model3dId`) REFERENCES `FileObject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Unit` ADD CONSTRAINT `Unit_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileObject` ADD CONSTRAINT `FileObject_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Certificate` ADD CONSTRAINT `Certificate_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Certificate` ADD CONSTRAINT `Certificate_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Certificate` ADD CONSTRAINT `Certificate_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CadastreCheck` ADD CONSTRAINT `CadastreCheck_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CadastreCheck` ADD CONSTRAINT `CadastreCheck_checkedById_fkey` FOREIGN KEY (`checkedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inspection` ADD CONSTRAINT `Inspection_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inspection` ADD CONSTRAINT `Inspection_inspectorId_fkey` FOREIGN KEY (`inspectorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionFile` ADD CONSTRAINT `InspectionFile_inspectionId_fkey` FOREIGN KEY (`inspectionId`) REFERENCES `Inspection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionFile` ADD CONSTRAINT `InspectionFile_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressUpdate` ADD CONSTRAINT `ProgressUpdate_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressUpdate` ADD CONSTRAINT `ProgressUpdate_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressMedia` ADD CONSTRAINT `ProgressMedia_progressId_fkey` FOREIGN KEY (`progressId`) REFERENCES `ProgressUpdate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressMedia` ADD CONSTRAINT `ProgressMedia_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_buyerOrgId_fkey` FOREIGN KEY (`buyerOrgId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `Purchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Signature` ADD CONSTRAINT `Signature_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Signature` ADD CONSTRAINT `Signature_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Complaint` ADD CONSTRAINT `Complaint_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Complaint` ADD CONSTRAINT `Complaint_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportThread` ADD CONSTRAINT `SupportThread_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportThread` ADD CONSTRAINT `SupportThread_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `SupportThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
