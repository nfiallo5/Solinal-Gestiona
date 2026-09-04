-- Drop "Idioma", "Medio de soporte", "Clasificación" and "Próxima revisión"
-- from Control Documental's "Encabezado" -> "Identificación y descripción"
-- checkbox set (none of the 5 header layouts actually rendered "medio" or
-- "próxima revisión" as of this migration; "idioma"/"clasificación" only fed
-- one preview line each). The route's zod schema no longer accepts these keys
-- (.strict()), so a row saved before this migration must have them stripped
-- or the next GET would hand back a shape the frontend/route no longer agree
-- on. Safe to run more than once (`-` on a missing key is a no-op).
UPDATE "DocumentHeaderConfig"
SET "campos" = "campos" - 'idioma' - 'medio' - 'clasificacion' - 'proximaRevision'
WHERE "id" = 1;
