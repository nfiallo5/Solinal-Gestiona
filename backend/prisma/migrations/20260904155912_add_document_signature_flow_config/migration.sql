-- CreateTable
CREATE TABLE "DocumentSignatureFlowConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "participacionDueno" BOOLEAN NOT NULL DEFAULT true,
    "etapas" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSignatureFlowConfig_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row with the same "Flujo de firmas" defaults Control
-- Documental has always shown (cfg.ctrl.participacionDueno + the hardcoded
-- Elaboró/Revisó/Aprobó table in frontend/src/routes/ControlDocumental.jsx,
-- which never actually persisted before this), so GET
-- /document-signature-flow never has to fall back and a fresh database
-- matches today's UI exactly. Idempotent (ON CONFLICT DO NOTHING) so it is
-- safe against an already-seeded database.
INSERT INTO "DocumentSignatureFlowConfig" ("id", "participacionDueno", "etapas", "updatedAt")
VALUES (
    1,
    true,
    '[{"etapa":"Elaboró","rol":"Dueño de proceso","obligatoria":true},{"etapa":"Revisó","rol":"Coordinador de calidad","obligatoria":true},{"etapa":"Aprobó","rol":"Alta dirección","obligatoria":true}]'::jsonb,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
