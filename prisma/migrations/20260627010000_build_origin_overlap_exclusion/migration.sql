-- Build-source variants are CONCURRENT: a model-year can ship from >1 plant with
-- the same name + overlapping years but different specs (e.g. the D40 Navara —
-- Barcelona vs Sriracha). The original exclusion key (modelId, name, year-range)
-- forbade that, blocking build splits.
--
-- Add buildOrigin to the key so same-name/overlapping-year rows are allowed ONLY
-- when the build origin differs. COALESCE(buildOrigin,'') makes NULL origins
-- compare equal, so the no-overlap guarantee is fully preserved for the ~all
-- variants that have no build split (NULLs would otherwise never collide).
-- More permissive than the old constraint → existing data always satisfies it.

ALTER TABLE "VehicleVariant" DROP CONSTRAINT no_overlapping_year_ranges;

ALTER TABLE "VehicleVariant"
ADD CONSTRAINT no_overlapping_year_ranges
EXCLUDE USING gist (
  "modelId" WITH =,
  "name" WITH =,
  (COALESCE("buildOrigin", '')) WITH =,
  int4range("yearFrom", "yearTo" + 1) WITH &&
);
