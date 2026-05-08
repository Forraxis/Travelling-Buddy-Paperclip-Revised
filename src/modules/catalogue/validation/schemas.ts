import { z } from "zod/v4";

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const vehicleFilterSchema = paginationSchema.extend({
  bodyType: z
    .enum([
      "DUAL_CAB_UTE",
      "SINGLE_CAB_UTE",
      "EXTRA_CAB_UTE",
      "WAGON",
      "SUV",
      "VAN",
      "TROOPCARRIER",
      "OTHER",
    ])
    .optional(),
  fuelType: z.enum(["DIESEL", "PETROL", "HYBRID", "ELECTRIC"]).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  market: z.enum(["AU", "NZ", "US", "EU", "GB"]).optional(),
});

export const caravanFilterSchema = paginationSchema.extend({
  bodyType: z
    .enum([
      "CARAVAN_POP_TOP",
      "CARAVAN_FULL_HEIGHT",
      "OFF_ROAD_CARAVAN",
      "CAMPER_TRAILER",
      "HYBRID",
      "FIFTH_WHEELER",
      "OTHER",
    ])
    .optional(),
  axleConfiguration: z
    .enum([
      "SINGLE_AXLE",
      "DUAL_AXLE_CLOSE_COUPLED",
      "DUAL_AXLE_SPREAD",
      "TRIPLE_AXLE",
    ])
    .optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  market: z.enum(["AU", "NZ", "US", "EU", "GB"]).optional(),
});

export const makeIdSchema = z.object({
  makeId: z.string().uuid(),
});

export const modelIdSchema = z.object({
  modelId: z.string().uuid(),
});

export const variantIdSchema = z.object({
  variantId: z.string().uuid(),
});
