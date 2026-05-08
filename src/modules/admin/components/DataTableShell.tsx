export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTableShell<T extends { id: string }>({
  columns,
  data,
  emptyMessage = 'No items found.',
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-tb-neutral-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-tb-neutral-200 bg-tb-neutral-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium text-gray-700 ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                className="border-b border-tb-neutral-200 last:border-0 hover:bg-tb-neutral-50"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
