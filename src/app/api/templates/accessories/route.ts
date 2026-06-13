import { generateCsvTemplate } from '@/modules/catalogue/csv/csv-parser';
import {
  ACCESSORY_CSV_HEADERS,
  ACCESSORY_CSV_EXAMPLE_ROW,
} from '@/modules/catalogue/csv/accessory-csv';

export function GET() {
  const csv = generateCsvTemplate(
    [...ACCESSORY_CSV_HEADERS],
    ACCESSORY_CSV_EXAMPLE_ROW,
  );
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="accessories-template.csv"',
    },
  });
}
