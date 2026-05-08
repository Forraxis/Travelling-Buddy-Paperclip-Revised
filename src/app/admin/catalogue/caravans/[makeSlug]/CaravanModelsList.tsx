"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import { ConfirmDialog } from "@/modules/admin/components/ConfirmDialog";
import { inputClassName, selectClassName } from "@/modules/admin/components/FormField";
import {
  createCaravanModelAction,
  updateCaravanModelAction,
  deleteCaravanModelAction,
} from "@/modules/catalogue/actions/caravan.actions";
import type {
  CaravanMakeWithModels,
  CaravanModelDto,
} from "@/modules/catalogue/types/caravan.types";
import type { CaravanBodyType } from "@prisma/client";

const BODY_TYPES: { value: CaravanBodyType; label: string }[] = [
  { value: "CARAVAN_POP_TOP", label: "Pop Top" },
  { value: "CARAVAN_FULL_HEIGHT", label: "Full Height" },
  { value: "OFF_ROAD_CARAVAN", label: "Off Road" },
  { value: "CAMPER_TRAILER", label: "Camper Trailer" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "FIFTH_WHEELER", label: "Fifth Wheeler" },
  { value: "OTHER", label: "Other" },
];

export function CaravanModelsList({ make }: { make: CaravanMakeWithModels }) {
  const router = useRouter();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBodyType, setCreateBodyType] =
    useState<CaravanBodyType>("CARAVAN_FULL_HEIGHT");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBodyType, setEditBodyType] = useState<CaravanBodyType>("CARAVAN_FULL_HEIGHT");
  const [deleteTarget, setDeleteTarget] = useState<CaravanModelDto | null>(null);

  async function handleCreate() {
    if (!createName.trim()) return;
    const result = await createCaravanModelAction({
      makeId: make.id,
      name: createName.trim(),
      bodyType: createBodyType,
    });
    if (result.success) {
      toast("Model created successfully");
      setShowCreate(false);
      setCreateName("");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleInlineEdit(id: string) {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    const result = await updateCaravanModelAction(id, {
      name: editName.trim(),
      bodyType: editBodyType,
    });
    if (result.success) {
      toast("Model updated");
      setEditingId(null);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteCaravanModelAction(deleteTarget.id);
    if (result.success) {
      toast("Model deleted");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  function bodyTypeLabel(bt: CaravanBodyType) {
    return BODY_TYPES.find((b) => b.value === bt)?.label ?? bt;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light"
        >
          + Add Model
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-lg border border-tb-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            New Model for {make.name}
          </h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Model name (e.g. Journey)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className={`${inputClassName} max-w-xs`}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <select
              value={createBodyType}
              onChange={(e) =>
                setCreateBodyType(e.target.value as CaravanBodyType)
              }
              className={`${selectClassName} max-w-[12rem]`}
            >
              {BODY_TYPES.map((bt) => (
                <option key={bt.value} value={bt.value}>
                  {bt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setCreateName("");
              }}
              className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-tb-neutral-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-tb-neutral-200 bg-tb-neutral-50">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Slug</th>
              <th className="px-4 py-3 font-medium text-gray-700">Body Type</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {make.models.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No models yet. Click &apos;+ Add Model&apos; to get started.
                </td>
              </tr>
            ) : (
              make.models.map((model) => (
                <tr
                  key={model.id}
                  className="border-b border-tb-neutral-200 last:border-0 hover:bg-tb-neutral-50"
                >
                  <td className="px-4 py-3">
                    {editingId === model.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleInlineEdit(model.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInlineEdit(model.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className={`${inputClassName} max-w-[12rem]`}
                        autoFocus
                      />
                    ) : (
                      <Link
                        href={`/admin/catalogue/caravans/${make.slug}/${model.slug}`}
                        className="font-medium text-tb-primary hover:underline"
                      >
                        {model.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{model.slug}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {editingId === model.id ? (
                      <select
                        value={editBodyType}
                        onChange={(e) =>
                          setEditBodyType(e.target.value as CaravanBodyType)
                        }
                        className={`${selectClassName} max-w-[10rem]`}
                      >
                        {BODY_TYPES.map((bt) => (
                          <option key={bt.value} value={bt.value}>
                            {bt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      bodyTypeLabel(model.bodyType)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingId(model.id);
                          setEditName(model.name);
                          setEditBodyType(model.bodyType);
                        }}
                        className="text-sm text-gray-500 hover:text-tb-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(model)}
                        className="text-sm text-gray-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Model"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all associated variants.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
