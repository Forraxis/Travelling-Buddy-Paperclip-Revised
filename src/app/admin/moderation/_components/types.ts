import type { SubmissionType } from "../actions";

export type VlmVerdict = "AUTO_APPROVE" | "QUEUE_FOR_REVIEW" | "AUTO_REJECT" | null;

export interface UnifiedSubmission {
  id: string;
  type: SubmissionType;
  status: string;
  entityName: string;
  photoUrl: string | null;
  vlmVerdict: VlmVerdict;
  vlmSummary: string | null;
  submitter: {
    id: string;
    name: string | null;
    trustTier: string;
  };
  createdAt: string; // ISO string for client serialization
}

export function getVlmVerdict(
  vlmGatekeeperResult: unknown,
  vlmSimilarityResult: unknown
): VlmVerdict {
  const gatekeeper = vlmGatekeeperResult as Record<string, unknown> | null;
  if (gatekeeper?.recommendedAction) {
    return gatekeeper.recommendedAction as VlmVerdict;
  }
  const similarity = vlmSimilarityResult as Record<string, unknown> | null;
  if (similarity?.recommendedAction) {
    return similarity.recommendedAction as VlmVerdict;
  }
  return null;
}

export function getVlmSummary(
  vlmGatekeeperResult: unknown,
  vlmSimilarityResult: unknown
): string | null {
  const gatekeeper = vlmGatekeeperResult as Record<string, unknown> | null;
  if (gatekeeper?.summary && typeof gatekeeper.summary === "string") {
    return gatekeeper.summary;
  }
  const similarity = vlmSimilarityResult as Record<string, unknown> | null;
  if (similarity?.summary && typeof similarity.summary === "string") {
    return similarity.summary;
  }
  return null;
}

export function getEntityName(submittedData: unknown, type: SubmissionType): string {
  if (!submittedData || typeof submittedData !== "object") return `${type} submission`;
  const d = submittedData as Record<string, unknown>;
  if (d.name && typeof d.name === "string") return d.name;
  const make = d.newMakeName ?? d.makeName ?? "";
  const model = d.newModelName ?? d.modelName ?? "";
  const year = d.year ?? "";
  const variant = d.variantName ?? "";
  const parts = [year, make, model, variant].filter(Boolean);
  return parts.length ? parts.join(" ") : `${type} submission`;
}

export function verdictLabel(verdict: VlmVerdict): string {
  switch (verdict) {
    case "AUTO_APPROVE": return "Likely good";
    case "QUEUE_FOR_REVIEW": return "Mixed signals";
    case "AUTO_REJECT": return "Likely problematic";
    default: return "No assessment";
  }
}

export function verdictPriority(verdict: VlmVerdict): number {
  switch (verdict) {
    case "QUEUE_FOR_REVIEW": return 0;
    case "AUTO_REJECT": return 1;
    case null: return 2;
    case "AUTO_APPROVE": return 3;
  }
}
