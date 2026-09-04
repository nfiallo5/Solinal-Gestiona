-- CreateTable
CREATE TABLE "DocumentHeaderConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tpl" TEXT NOT NULL DEFAULT 'tripartito',
    "campos" JSONB NOT NULL,
    "bordes" TEXT NOT NULL DEFAULT 'completo',
    "repetir" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentHeaderConfig_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row with the same header defaults Control Documental's
-- "Encabezado" tab has always shown (DEFAULT.header in
-- frontend/src/routes/ControlDocumental.jsx), so GET /document-header never
-- has to fall back and a fresh database matches today's UI exactly. Idempotent
-- (ON CONFLICT DO NOTHING) so it is safe against an already-seeded database.
INSERT INTO "DocumentHeaderConfig" ("id", "tpl", "campos", "bordes", "repetir", "updatedAt")
VALUES (
    1,
    'tripartito',
    '{"logo":true,"razonSocial":true,"titulo":true,"tipoDoc":true,"proceso":true,"codigo":true,"version":true,"fechaElaboracion":true,"fechaRevision":true,"fechaAprobacion":false,"vigencia":true,"proximaRevision":false,"pagina":true,"responsable":true,"autor":true,"objetivo":false,"clasificacion":false,"idioma":false,"medio":false,"estado":true}'::jsonb,
    'completo',
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
