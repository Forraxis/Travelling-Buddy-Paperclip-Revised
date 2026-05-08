import { generateCsvTemplate } from "@/modules/catalogue/csv/csv-parser";
import {
  CARAVAN_CSV_HEADERS,
  CARAVAN_CSV_EXAMPLE_ROW,
} from "@/modules/catalogue/csv/caravan-csv";

export function GET() {
  const csv = generateCsvTemplate(
    [...CARAVAN_CSV_HEADERS],
    CARAVAN_CSV_EXAMPLE_ROW
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="caravans-template.csv"',
    },
  });
}
