-- Build source / country of manufacture for vehicle variants
-- (CATALOGUE_GRANULARITY_PLAN.md §4). Some model-years ship from more than one
-- plant with materially different GVM / axle ratings / dimensions (e.g. the D40
-- Navara: Barcelona vs Sriracha builds, concurrent across years). This pins which
-- build a variant describes.
--
-- ISO-3166 alpha-2 country code (ES, TH, JP, AU, …). Nullable + additive →
-- backward-compatible; the picker auto-hides the "Origin" step unless a model-year
-- actually carries >1 distinct value. VIN-derivable (WMI prefix → country) so the
-- plate-confirm path can auto-select the right build.

-- AlterTable
ALTER TABLE "VehicleVariant" ADD COLUMN "buildOrigin" TEXT;
