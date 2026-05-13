"use client";

import { useState } from "react";
import type { RegulationVersionDto } from "@/modules/regulations/types/regulation.types";
import type { RegulationData } from "@/modules/regulations/types/regulation.types";

interface Props {
  versions: RegulationVersionDto[];
}

function flattenData(data: RegulationData): Record<string, string> {
  const out: Record<string, string> = {};

  const add = (prefix: string, obj: unknown) => {
    if (obj === null || obj === undefined) return;
    if (typeof obj === "object" && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        add(`${prefix}.${k}`, v);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => add(`${prefix}[${i}]`, item));
    } else {
      out[prefix] = String(obj);
    }
  };

  add("gvmUpgrade", data.gvmUpgrade);
  add("towingLicence", data.towingLicence);
  add("trailerBrakes", data.trailerBrakes);
  add("lengthLimits", data.lengthLimits);
  add("overhangLimits", data.overhangLimits);
  add("towingSpeedLimits", data.towingSpeedLimits);
  add("regulatoryReferences", data.regulatoryReferences);

  return out;
}

function DiffView({
  versionA,
  versionB,
}: {
  versionA: RegulationVersionDto;
  versionB: RegulationVersionDto;
}) {
  const a = flattenData(versionA.data);
  const b = flattenData(versionB.data);
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  const changed: { key: string; from: string; to: string }[] = [];
  const added: { key: string; value: string }[] = [];
  const removed: { key: string; value: string }[] = [];

  for (const key of allKeys) {
    if (key in a && key in b) {
      if (a[key] !== b[key]) changed.push({ key, from: a[key], to: b[key] });
    } else if (!(key in a)) {
      added.push({ key, value: b[key] });
    } else {
      removed.push({ key, value: a[key] });
    }
  }

  if (changed.length === 0 && added.length === 0 && removed.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-tb-neutral-400">
        No differences between these versions.
      </p>
    );
  }

  return (
    <div className="space-y-1 text-xs">
      {changed.map(({ key, from, to }) => (
        <div key={key} className="rounded bg-yellow-50 px-3 py-1.5">
          <span className="font-mono text-tb-neutral-500">{key}</span>
          <div className="mt-0.5 flex gap-4">
            <span className="text-red-600 line-through">{from}</span>
            <span className="text-green-700">{to}</span>
          </div>
        </div>
      ))}
      {added.map(({ key, value }) => (
        <div key={key} className="rounded bg-green-50 px-3 py-1.5">
          <span className="font-mono text-tb-neutral-500">{key}</span>
          <div className="mt-0.5 text-green-700">+ {value}</div>
        </div>
      ))}
      {removed.map(({ key, value }) => (
        <div key={key} className="rounded bg-red-50 px-3 py-1.5">
          <span className="font-mono text-tb-neutral-500">{key}</span>
          <div className="mt-0.5 text-red-600 line-through">- {value}</div>
        </div>
      ))}
    </div>
  );
}

export function VersionHistoryClient({ versions }: Props) {
  const [diffA, setDiffA] = useState<string>("");
  const [diffB, setDiffB] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const versionMap = new Map(versions.map((v) => [v.id, v]));

  const versionA = diffA ? versionMap.get(diffA) : undefined;
  const versionB = diffB ? versionMap.get(diffB) : undefined;

  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-tb-neutral-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-tb-neutral-400">No versions saved yet.</p>
        <p className="mt-1 text-xs text-tb-neutral-300">
          Use the edit page to save the first version.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Diff selector */}
      {versions.length >= 2 && (
        <div className="rounded-lg border border-tb-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Compare Versions</h3>
          <div className="flex items-center gap-3">
            <select
              className="flex-1 rounded-md border border-tb-neutral-200 px-3 py-2 text-sm"
              value={diffA}
              onChange={(e) => setDiffA(e.target.value)}
            >
              <option value="">Select version A (from)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} — {new Date(v.effectiveDate).toLocaleDateString("en-AU")} —{" "}
                  {v.changeSummary.slice(0, 40)}
                </option>
              ))}
            </select>
            <span className="text-tb-neutral-400">→</span>
            <select
              className="flex-1 rounded-md border border-tb-neutral-200 px-3 py-2 text-sm"
              value={diffB}
              onChange={(e) => setDiffB(e.target.value)}
            >
              <option value="">Select version B (to)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} — {new Date(v.effectiveDate).toLocaleDateString("en-AU")} —{" "}
                  {v.changeSummary.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          {versionA && versionB && versionA.id !== versionB.id && (
            <div className="mt-4">
              <DiffView versionA={versionA} versionB={versionB} />
            </div>
          )}
          {versionA && versionB && versionA.id === versionB.id && (
            <p className="mt-3 text-xs text-tb-neutral-400">Select two different versions to compare.</p>
          )}
        </div>
      )}

      {/* Version list */}
      <div className="overflow-hidden rounded-lg border border-tb-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-tb-neutral-200">
          <thead className="bg-tb-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Version
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Effective Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Change Summary
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Author
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Saved At
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-tb-neutral-100">
            {versions.map((v) => (
              <>
                <tr
                  key={v.id}
                  className="hover:bg-tb-neutral-50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    v{v.versionNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-tb-neutral-600">
                    {new Date(v.effectiveDate).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{v.changeSummary}</td>
                  <td className="px-4 py-3 text-sm text-tb-neutral-500">
                    {v.createdByName ?? v.createdById.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-tb-neutral-500">
                    {new Date(v.createdAt).toLocaleString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {expandedId === v.id ? "Hide data" : "View data"}
                    </button>
                  </td>
                </tr>
                {expandedId === v.id && (
                  <tr key={`${v.id}-expanded`}>
                    <td colSpan={6} className="bg-tb-neutral-50 px-4 py-3">
                      <pre className="max-h-96 overflow-auto rounded border border-tb-neutral-200 bg-white p-3 text-xs text-gray-600">
                        {JSON.stringify(v.data, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
