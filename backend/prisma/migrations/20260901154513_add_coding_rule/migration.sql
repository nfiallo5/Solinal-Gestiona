-- CreateTable
CREATE TABLE "CodingRule" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tokens" TEXT[] DEFAULT ARRAY['TIPO', 'PROCESO', 'CORRELATIVO']::TEXT[],
    "separador" TEXT NOT NULL DEFAULT '-',
    "digitos" INTEGER NOT NULL DEFAULT 3,
    "prefijoVer" TEXT NOT NULL DEFAULT 'V',
    "formatoAnio" TEXT NOT NULL DEFAULT '26',
    "empresaSigla" TEXT NOT NULL DEFAULT 'SOL',
    "unico" BOOLEAN NOT NULL DEFAULT true,
    "hereda" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingRule_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so GET/PUT /coding-rule and document creation
-- never 404/fall back on a fresh database — matches today's actual
-- TIPO-AREA-NNN document codes exactly, so nothing changes behaviorally
-- until an Administrador edits the rule from Control Documental.
-- Idempotent (ON CONFLICT DO NOTHING) so it's safe against an
-- already-seeded database too.
INSERT INTO "CodingRule" ("id", "tokens", "separador", "digitos", "prefijoVer", "formatoAnio", "empresaSigla", "unico", "hereda", "updatedAt")
VALUES (1, ARRAY['TIPO', 'PROCESO', 'CORRELATIVO']::TEXT[], '-', 3, 'V', '26', 'SOL', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
