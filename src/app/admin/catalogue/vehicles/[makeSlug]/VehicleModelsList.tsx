'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import { ConfirmDialog } from '@/modules/admin/components/ConfirmDialog';
import {
  inputClassName,
  selectClassName,
} from '@/modules/admin/components/FormField';
import {
  createModelAction,
  updateModelAction,
  deleteModelAction,
} from '@/modules/catalogue/actions/vehicle.actions';
import type {
  VehicleMakeWithModels,
  VehicleModelDto,
} from '@/modules/catalogue/types/vehicle.types';
import type { VehicleBodyType } from '@prisma/client';

const BODY_TYPES: { value: VehicleBodyType; label: string }[] = [
  { value: 'DUAL_CAB_UTE', label: 'Dual Cab Ute' },
  { value: 'SINGLE_CAB_UTE', label: 'Single Cab Ute' },
  { value: 'EXTRA_CAB_UTE', label: 'Extra Cab Ute' },
  { value: 'WAGON', label: 'Wagon' },
  { value: 'SUV', label: 'SUV' },
  { value: 'VAN', label: 'Van' },
  { value: 'TROOPCARRIER', label: 'Troopcarrier' },
  { value: 'OTHER', label: 'Other' },
];

export function VehicleModelsList({ make }: { make: VehicleMakeWithModels }) {
  const router = useRouter();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createBodyType, setCreateBodyType] =
    useState<VehicleBodyType>('DUAL_CAB_UTE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBodyType, setEditBodyType] =
    useState<VehicleBodyType>('DUAL_CAB_UTE');
  const [deleteTarget, setDeleteTarget] = useState<VehicleModelDto | null>(
    null,
  );

  async function handleCreate() {
    if (!createName.trim()) return;
    const result = await createModelAction({
      makeId: make.id,
      name: createName.trim(),
      bodyType: createBodyType,
    });
    if (result.success) {
      toast('Model created successfully');
      setShowCreate(false);
      setCreateName('');
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  async function handleInlineEdit(id: string) {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    const result = await updateModelAction(id, {
      name: editName.trim(),
      bodyType: editBodyType,
    });
    if (result.success) {
      toast('Model updated');
      setEditingId(null);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteModelAction(deleteTarget.id);
    if (result.success) {
      toast('Model deleted');
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  function bodyTypeLabel(bt: VehicleBodyType) {
    return BODY_TYPES.find((b) => b.value === bt)?.label ?? bt;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          + Add Model
        </button>
      </div>

      {showCreate && (
        <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            New Model for {make.name}
          </h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Model name (e.g. HiLux)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className={`${inputClassName} max-w-xs`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select
              value={createBodyType}
              onChange={(e) =>
                setCreateBodyType(e.target.value as VehicleBodyType)
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
              className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setCreateName('');
              }}
              className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Slug</th>
              <th className="px-4 py-3 font-medium text-gray-700">Body Type</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {make.models.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No models yet. Click &apos;+ Add Model&apos; to get started.
                </td>
              </tr>
            ) : (
              make.models.map((model) => (
                <tr
                  key={model.id}
                  className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                >
                  <td className="px-4 py-3">
                    {editingId === model.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleInlineEdit(model.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineEdit(model.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className={`${inputClassName} max-w-[12rem]`}
                        autoFocus
                      />
                    ) : (
                      <Link
                        href={`/admin/catalogue/vehicles/${make.slug}/${model.slug}`}
                        className="text-tb-primary font-medium hover:underline"
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
                          setEditBodyType(e.target.value as VehicleBodyType)
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
                        className="hover:text-tb-primary text-sm text-gray-500"
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
