-- CreateTable
CREATE TABLE "DocumentTypeCatalog" (
    "sigla" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "digitos" INTEGER NOT NULL DEFAULT 3,
    "retencion" TEXT NOT NULL,
    "firma" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTypeCatalog_pkey" PRIMARY KEY ("sigla")
);

-- CreateIndex
CREATE INDEX "DocumentTypeCatalog_orden_idx" ON "DocumentTypeCatalog"("orden");

-- Seed 1:1 with the 5 current DocumentType enum values (documentTypeAbbr /
-- documentTypeOptions in docStyles.ts), so this table starts in sync with
-- what the enum already enforces. Safe to run against an already-seeded
-- database too -- ON CONFLICT DO NOTHING makes it idempotent.
INSERT INTO "DocumentTypeCatalog" ("sigla", "nombre", "nivel", "digitos", "retencion", "firma", "orden", "updatedAt") VALUES
    ('PRO', 'Procedimiento', 2, 3, '5 años', true, 0, CURRENT_TIMESTAMP),
    ('POL', 'Política', 1, 3, 'Permanente', true, 1, CURRENT_TIMESTAMP),
    ('INS', 'Instructivo', 3, 3, '3 años', true, 2, CURRENT_TIMESTAMP),
    ('MAN', 'Manual', 1, 3, 'Permanente', true, 3, CURRENT_TIMESTAMP),
    ('CHK', 'Checklist', 4, 3, '3 años', true, 4, CURRENT_TIMESTAMP)
ON CONFLICT ("sigla") DO NOTHING;
