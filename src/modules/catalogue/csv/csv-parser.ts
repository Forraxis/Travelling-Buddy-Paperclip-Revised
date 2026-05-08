/**
 * Generic RFC 4180-compatible CSV parser.
 * Works in browser (FileReader output) and Node (server actions).
 */
export function parseCsvToRecords(text: string): {
  headers: string[];
  records: Record<string, string>[];
} {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l, i) => i === 0 || l.trim() !== "");

  if (nonEmpty.length === 0) return { headers: [], records: [] };

  const headers = parseCsvRow(nonEmpty[0]).map((h) => h.trim().toLowerCase());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const line = nonEmpty[i].trim();
    if (!line) continue;
    const values = parseCsvRow(line);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (values[idx] ?? "").trim();
    });
    records.push(record);
  }

  return { headers, records };
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      // Trailing comma edge case handled by final push
      break;
    }

    if (line[i] === '"') {
      i++;
      let field = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          field += line[i++];
        }
      }
      result.push(field);
      if (line[i] === ",") i++;
    } else {
      const commaIdx = line.indexOf(",", i);
      if (commaIdx === -1) {
        result.push(line.slice(i));
        i = line.length;
      } else {
        result.push(line.slice(i, commaIdx));
        i = commaIdx + 1;
      }
    }
  }

  if (line.endsWith(",")) result.push("");

  return result;
}

export function generateCsvTemplate(
  headers: string[],
  exampleRow: string[]
): string {
  const headerLine = headers.join(",");
  const exampleLine = exampleRow
    .map((v) => (v.includes(",") ? `"${v}"` : v))
    .join(",");
  return `${headerLine}\n${exampleLine}\n`;
}
