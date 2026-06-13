import { generateCsvTemplate } from '@/modules/catalogue/csv/csv-parser';
import {
  FITMENT_CSV_HEADERS,
  FITMENT_CSV_EXAMPLE_ROW,
} from '@/modules/catalogue/csv/fitment-csv';

export function GET() {
  const csv = generateCsvTemplate(
    [...FITMENT_CSV_HEADERS],
    FITMENT_CSV_EXAMPLE_ROW,
  );
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition':
        'attachment; filename="accessory-fitments-template.csv"',
    },
  });
}
