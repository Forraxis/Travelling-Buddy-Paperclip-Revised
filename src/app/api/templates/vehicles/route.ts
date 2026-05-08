import { generateCsvTemplate } from "@/modules/catalogue/csv/csv-parser";
import {
  VEHICLE_CSV_HEADERS,
  VEHICLE_CSV_EXAMPLE_ROW,
} from "@/modules/catalogue/csv/vehicle-csv";

export function GET() {
  const csv = generateCsvTemplate(
    [...VEHICLE_CSV_HEADERS],
    VEHICLE_CSV_EXAMPLE_ROW
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="vehicles-template.csv"',
    },
  });
}
