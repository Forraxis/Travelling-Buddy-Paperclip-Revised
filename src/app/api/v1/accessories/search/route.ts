import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAccessoryService } from "@/modules/catalogue/services/accessory.service";
import { accessorySearchPickerSchema } from "@/modules/catalogue/validation/schemas";
import { parseSearchParams, withRateLimit, serverError } from "@/lib/api-helpers";

const service = createAccessoryService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, accessorySearchPickerSchema);
  if ("error" in parsed) return parsed.error;

  const { q, limit } = parsed.data;

  try {
    const results = await service.searchForPicker(q, limit ?? 15);
    return NextResponse.json({ items: results });
  } catch (err) {
    return serverError(err);
  }
}
