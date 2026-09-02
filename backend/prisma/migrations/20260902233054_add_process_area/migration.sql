-- CreateTable
CREATE TABLE "ProcessArea" (
    "sigla" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessArea_pkey" PRIMARY KEY ("sigla")
);

-- CreateIndex
CREATE INDEX "ProcessArea_orden_idx" ON "ProcessArea"("orden");

-- Seed the 9 processes/areas Control Documental's "Procesos y áreas" table
-- has always shown (PROCESOS_INI in frontend/src/routes/ControlDocumental.jsx),
-- so the "Área / Departamento" dropdown in Crear Documento and the `area`
-- accepted by POST /documents both start from this list instead of a
-- hardcoded 6-value one. Idempotent (ON CONFLICT DO NOTHING) so it is safe
-- against an already-seeded database.
INSERT INTO "ProcessArea" ("sigla", "nombre", "orden", "updatedAt") VALUES
    ('GER', 'Gerencia y estrategia', 0, CURRENT_TIMESTAMP),
    ('CAL', 'Aseguramiento de la calidad', 1, CURRENT_TIMESTAMP),
    ('PRD', 'Producción', 2, CURRENT_TIMESTAMP),
    ('MTO', 'Mantenimiento y metrología', 3, CURRENT_TIMESTAMP),
    ('RHU', 'Talento humano', 4, CURRENT_TIMESTAMP),
    ('LOG', 'Logística y almacenamiento', 5, CURRENT_TIMESTAMP),
    ('COM', 'Compras y comercial', 6, CURRENT_TIMESTAMP),
    ('IDD', 'Investigación y desarrollo', 7, CURRENT_TIMESTAMP),
    ('SSA', 'Seguridad, salud y ambiente', 8, CURRENT_TIMESTAMP)
ON CONFLICT ("sigla") DO NOTHING;
