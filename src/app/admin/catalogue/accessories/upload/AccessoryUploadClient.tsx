'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import {
  previewAccessoryUploadAction,
  commitAccessoryUploadAction,
} from '@/modules/catalogue/actions/accessory-upload.actions';
import type {
  AccessoryCsvPreviewResult,
  AccessoryCsvRowResult,
} from '@/modules/catalogue/csv/accessory-csv';

type Step = 'upload' | 'preview' | 'done';

export function AccessoryUploadClient() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<AccessoryCsvPreviewResult | null>(
    null,
  );
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  async function processFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast('Please upload a .csv file', 'error');
      return;
    }
    setFileName(file.name);
    setLoading(true);
    const text = await file.text();
    setCsvText(text);

    const result = await previewAccessoryUploadAction(text);
    setLoading(false);

    if (!result.success) {
      toast(result.error, 'error');
      return;
    }

    setPreview(result.data);
    setStep('preview');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  async function handleCommit() {
    if (!preview || preview.errorRows > 0) return;
    setLoading(true);
    const result = await commitAccessoryUploadAction(csvText);
    setLoading(false);

    if (!result.success) {
      toast(result.error, 'error');
      return;
    }

    setImportResult(result.data);
    setStep('done');
  }

  function handleReset() {
    setStep('upload');
    setFileName(null);
    setCsvText('');
    setPreview(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (step === 'done') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <div className="mb-3 text-4xl">✓</div>
        <h2 className="mb-1 text-xl font-semibold text-green-800">
          Import complete
        </h2>
        <p className="mb-6 text-sm text-green-700">
          {importResult?.imported} accessor(y/ies) imported.
          {(importResult?.skipped ?? 0) > 0 &&
            ` ${importResult?.skipped} skipped (already existed).`}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleReset}
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
          >
            Upload another file
          </button>
          <button
            onClick={() => router.push('/admin/catalogue/accessories')}
            className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            Back to accessories
          </button>
        </div>
      </div>
    );
  }

  if (step === 'preview' && preview) {
    return (
      <div className="space-y-6">
        <PreviewSummary preview={preview} />
        <PreviewTable rows={preview.rows} />
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleReset}
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            disabled={preview.errorRows > 0 || loading}
            className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Importing…'
              : `Import ${preview.deduplicated.length} accessor(y/ies)`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a
          href="/api/templates/accessories"
          download="accessories-template.csv"
          className="border-tb-neutral-200 hover:bg-tb-neutral-50 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
        >
          ↓ Download CSV template
        </a>
        <span className="text-sm text-gray-500">
          Fill in the template, then upload below.
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 transition-colors ${
          dragging
            ? 'border-tb-primary bg-blue-50'
            : 'border-tb-neutral-200 hover:border-tb-primary hover:bg-tb-neutral-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
        {loading ? (
          <p className="text-sm text-gray-500">Parsing…</p>
        ) : (
          <>
            <div className="mb-3 text-4xl text-gray-300">📄</div>
            <p className="mb-1 text-sm font-medium text-gray-700">
              {fileName ?? 'Drop a CSV file here, or click to browse'}
            </p>
            <p className="text-xs text-gray-400">Supports .csv files only</p>
          </>
        )}
      </div>

      <div className="border-tb-neutral-200 bg-tb-neutral-50 rounded-lg border p-4 text-xs text-gray-500">
        <p className="mb-1 font-medium text-gray-700">Required columns:</p>
        <p>brand_name, category_name, name</p>
        <p className="mt-1 font-medium text-gray-700">Optional:</p>
        <p>slug (auto-derived from name), description</p>
        <p>status: ACTIVE (default), DISCONTINUED, PLACEHOLDER</p>
      </div>
    </div>
  );
}

function PreviewSummary({ preview }: { preview: AccessoryCsvPreviewResult }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Input rows" value={preview.totalInputRows} />
      <StatCard label="Valid rows" value={preview.validRows} color="green" />
      <StatCard
        label="Error rows"
        value={preview.errorRows}
        color={preview.errorRows > 0 ? 'red' : 'gray'}
      />
      <StatCard
        label="To import"
        value={preview.deduplicated.length}
        color="blue"
        note={
          preview.duplicateRows > 0
            ? `${preview.duplicateRows} duplicate(s) merged`
            : undefined
        }
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'gray',
  note,
}: {
  label: string;
  value: number;
  color?: 'gray' | 'green' | 'red' | 'blue';
  note?: string;
}) {
  const colorMap = {
    gray: 'text-gray-800',
    green: 'text-green-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
  };
  return (
    <div className="border-tb-neutral-200 rounded-lg border bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-gray-400">{note}</p>}
    </div>
  );
}

function PreviewTable({ rows }: { rows: AccessoryCsvRowResult[] }) {
  return (
    <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              Row
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              Brand
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              Category
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              Status
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              Valid
            </th>
          </tr>
        </thead>
        <tbody className="divide-tb-neutral-100 divide-y">
          {rows.map((row) => (
            <PreviewRow key={row.rowNumber} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewRow({ row }: { row: AccessoryCsvRowResult }) {
  const isValid = !!row.parsed;
  const errorMessages = row.errors
    ? Object.entries(row.errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')
    : null;

  return (
    <tr className={isValid ? 'bg-white' : 'bg-red-50'}>
      <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
      <td className="px-3 py-2 font-medium text-gray-900">
        {row.parsed?.brandName ?? row.raw.brand_name ?? '—'}
      </td>
      <td className="px-3 py-2 text-gray-700">
        {row.parsed?.categoryName ?? row.raw.category_name ?? '—'}
      </td>
      <td className="px-3 py-2 text-gray-700">
        {row.parsed?.name ?? row.raw.name ?? '—'}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {row.parsed?.status ?? row.raw.status ?? 'ACTIVE'}
      </td>
      <td className="px-3 py-2">
        {isValid ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            Valid
          </span>
        ) : (
          <span
            className="inline-flex max-w-[200px] cursor-help items-center truncate rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
            title={errorMessages ?? ''}
          >
            {errorMessages}
          </span>
        )}
      </td>
    </tr>
  );
}
