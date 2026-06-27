-- Typo-tolerant catalogue search (CATALOGUE_GRANULARITY_PLAN.md milestone 4, sub-task 1).
-- pg_trgm powers word_similarity() in the picker search routes ("navarra" → Navara) and
-- the GIN trigram indexes accelerate both the similarity operators and the ILIKE substring
-- matches on the name columns the search hits.
--
-- IF NOT EXISTS throughout so this is idempotent on the shared remote (the extension was
-- already enabled there) while still building cleanly on a fresh CI / dev database.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "VehicleVariant_name_trgm_idx" ON "VehicleVariant" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "VehicleModel_name_trgm_idx" ON "VehicleModel" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "VehicleMake_name_trgm_idx" ON "VehicleMake" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CaravanVariant_name_trgm_idx" ON "CaravanVariant" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CaravanModel_name_trgm_idx" ON "CaravanModel" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CaravanMake_name_trgm_idx" ON "CaravanMake" USING gin ("name" gin_trgm_ops);
