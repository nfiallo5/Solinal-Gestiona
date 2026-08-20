-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Procedimiento', 'Política', 'Manual', 'Instructivo', 'Checklist');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('Borrador', 'En aprobación', 'Aprobado', 'Rechazado');

-- CreateEnum
CREATE TYPE "TemplateLevel" AS ENUM ('Política', 'Manual', 'Procedimiento', 'Instructivo', 'Registro');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('Administrador', 'Elaborador', 'Revisor', 'Aprobador', 'Lector');

-- CreateEnum
CREATE TYPE "PeriodicidadRevision" AS ENUM ('Anual', 'Bienal', 'Semestral', 'No aplica');

-- CreateEnum
CREATE TYPE "PasswordPolicy" AS ENUM ('weak', 'medium', 'strong');

-- CreateEnum
CREATE TYPE "DoubleApproval" AS ENUM ('none', 'critical', 'all');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "status" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "norma" TEXT NOT NULL,
    "estado" "DocumentStatus" NOT NULL,
    "version" TEXT NOT NULL,
    "creadorId" TEXT NOT NULL,
    "creador" TEXT NOT NULL,
    "vencido" BOOLEAN NOT NULL DEFAULT false,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "nivel" "TemplateLevel",
    "rolesRequeridos" JSONB,
    "sectionLocked" BOOLEAN NOT NULL DEFAULT false,
    "contentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "DocumentSignature" (
    "id" TEXT NOT NULL,
    "documentCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRevision" (
    "id" SERIAL NOT NULL,
    "documentCode" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "norma" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "desc" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mandatory" TEXT[],
    "nivel" "TemplateLevel" NOT NULL,
    "clausulaIso" TEXT NOT NULL,
    "secciones" JSONB NOT NULL,
    "periodicidadRevision" "PeriodicidadRevision" NOT NULL,
    "tiempoRetencionAnios" INTEGER NOT NULL,
    "documentoPadreKey" TEXT,
    "rolesRequeridos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentComment" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "orgName" TEXT NOT NULL,
    "brandColor" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passwordPolicy" "PasswordPolicy" NOT NULL,
    "doubleApproval" "DoubleApproval" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanImport" (
    "id" SERIAL NOT NULL,
    "documentCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationAlert" (
    "id" SERIAL NOT NULL,
    "norma" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Document_estado_idx" ON "Document"("estado");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_norma_idx" ON "Document"("norma");

-- CreateIndex
CREATE INDEX "Document_vencido_idx" ON "Document"("vencido");

-- CreateIndex
CREATE INDEX "DocumentSignature_documentCode_signedAt_idx" ON "DocumentSignature"("documentCode", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSignature_documentCode_userId_key" ON "DocumentSignature"("documentCode", "userId");

-- CreateIndex
CREATE INDEX "DocumentRevision_documentCode_id_idx" ON "DocumentRevision"("documentCode", "id");

-- CreateIndex
CREATE INDEX "AuditLogEntry_createdAt_idx" ON "AuditLogEntry"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLogEntry_user_idx" ON "AuditLogEntry"("user");

-- CreateIndex
CREATE INDEX "AuditLogEntry_role_idx" ON "AuditLogEntry"("role");

-- CreateIndex
CREATE INDEX "DocumentComment_code_createdAt_idx" ON "DocumentComment"("code", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "ScanImport_documentCode_createdAt_idx" ON "ScanImport"("documentCode", "createdAt");

-- CreateIndex
CREATE INDEX "RegulationAlert_norma_active_idx" ON "RegulationAlert"("norma", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationAlert_norma_marker_key" ON "RegulationAlert"("norma", "marker");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_documentCode_fkey" FOREIGN KEY ("documentCode") REFERENCES "Document"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_documentCode_fkey" FOREIGN KEY ("documentCode") REFERENCES "Document"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_documentoPadreKey_fkey" FOREIGN KEY ("documentoPadreKey") REFERENCES "DocumentTemplate"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_code_fkey" FOREIGN KEY ("code") REFERENCES "Document"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanImport" ADD CONSTRAINT "ScanImport_documentCode_fkey" FOREIGN KEY ("documentCode") REFERENCES "Document"("code") ON DELETE CASCADE ON UPDATE CASCADE;
