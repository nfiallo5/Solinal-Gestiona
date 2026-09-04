-- CreateTable
CREATE TABLE "DocumentFooterConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tpl" TEXT NOT NULL DEFAULT 'firmasTabla',
    "clasificacion" TEXT NOT NULL DEFAULT 'Documento de uso interno',
    "leyenda" TEXT NOT NULL DEFAULT '',
    "qr" BOOLEAN NOT NULL DEFAULT true,
    "hash" BOOLEAN NOT NULL DEFAULT false,
    "impresion" BOOLEAN NOT NULL DEFAULT true,
    "mostrarCargo" BOOLEAN NOT NULL DEFAULT true,
    "mostrarFecha" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFooterConfig_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row with the same footer defaults Control Documental's
-- "Pie de página" tab has always shown (DEFAULT.footer in
-- frontend/src/routes/ControlDocumental.jsx), so GET /document-footer never
-- has to fall back and a fresh database matches today's UI exactly. Idempotent
-- (ON CONFLICT DO NOTHING) so it is safe against an already-seeded database.
INSERT INTO "DocumentFooterConfig" ("id", "tpl", "clasificacion", "leyenda", "qr", "hash", "impresion", "mostrarCargo", "mostrarFecha", "updatedAt")
VALUES (
    1,
    'firmasTabla',
    'Documento de uso interno',
    '“COPIA NO CONTROLADA”: el departamento de Calidad no garantiza que esta impresión sea la última versión del documento.',
    true,
    false,
    true,
    true,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
