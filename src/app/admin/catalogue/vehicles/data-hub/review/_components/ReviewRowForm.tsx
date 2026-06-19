'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setBaseIdentityAction } from '../actions';

/**
 * Inline curation form for one NEEDS_REVIEW row. Admin types the resolved base
 * make/model (+ optional modifier) and saves → server action flips the row to MANUAL.
 */
export function ReviewRowForm({
  id,
  defaultBaseMake,
  defaultBaseModel,
  defaultModifier,
  makeSuggestions,
}: {
  id: string;
  defaultBaseMake: string;
  defaultBaseModel: string;
  defaultModifier: string;
  /** Known base makes (datalist) so admins reuse canonical spellings. */
  makeSuggestions: string[];
}) {
  const router = useRouter();
  const [baseMake, setBaseMake] = useState(defaultBaseMake);
  const [baseModel, setBaseModel] = useState(defaultBaseModel);
  const [modifier, setModifier] = useState(defaultModifier);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const listId = `makes-${id}`;

  function save() {
    setMsg(null);
    setIsError(false);
    startTransition(async () => {
      const res = await setBaseIdentityAction({
        id,
        baseMake,
        baseModel,
        modifier,
      });
      if (res.success) {
        setMsg('Saved ✓ — set to MANUAL');
        setIsError(false);
        router.refresh();
      } else {
        setMsg(res.error ?? 'Failed to save');
        setIsError(true);
      }
    });
  }

  const canSave =
    !isPending && baseMake.trim().length > 0 && baseModel.trim().length > 0;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <datalist id={listId}>
        {makeSuggestions.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <label className="flex flex-col text-xs font-medium text-gray-600">
        Base make
        <input
          type="text"
          list={listId}
          value={baseMake}
          onChange={(e) => setBaseMake(e.target.value)}
          placeholder="e.g. Toyota"
          className="mt-1 w-36 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
      </label>
      <label className="flex flex-col text-xs font-medium text-gray-600">
        Base model
        <input
          type="text"
          value={baseModel}
          onChange={(e) => setBaseModel(e.target.value)}
          placeholder="e.g. Hilux"
          className="mt-1 w-40 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
      </label>
      <label className="flex flex-col text-xs font-medium text-gray-600">
        Modifier
        <input
          type="text"
          value={modifier}
          onChange={(e) => setModifier(e.target.value)}
          placeholder="optional"
          className="mt-1 w-32 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save (→ MANUAL)'}
      </button>
      {msg && (
        <span
          className={`text-xs ${isError ? 'text-red-600' : 'text-green-600'}`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
