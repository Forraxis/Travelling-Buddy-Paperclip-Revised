import { promoteUserTrustTier } from '@/lib/trust-tier';
import {
  sendSubmissionApprovedEmail,
  sendSubmissionRejectedEmail,
  sendTrustTierPromotedEmail,
} from '@/lib/email/send';

export type SubmissionKind = 'vehicle' | 'caravan' | 'accessory';

export interface ModerationDecisionParams {
  submitterId: string;
  submissionId: string;
  kind: SubmissionKind;
  decision: 'APPROVED' | 'REJECTED';
  entityName: string;
  // Required for approved submissions so the email can link to the live entry
  catalogueUrl?: string;
  // Required for rejected submissions
  rejectionReason?: string | null;
}

// Called server-side after each moderation decision.
// Handles trust tier promotion and sends notification emails.
export async function handleModerationDecision(
  params: ModerationDecisionParams,
): Promise<void> {
  const {
    submitterId,
    submissionId,
    decision,
    entityName,
    catalogueUrl,
    rejectionReason,
  } = params;

  if (decision === 'APPROVED') {
    // Send submission approved email (fire-and-forget errors to not break moderation flow)
    sendSubmissionApprovedEmail(
      submitterId,
      entityName,
      catalogueUrl ?? '/account/submissions',
    ).catch((err) => console.error('sendSubmissionApprovedEmail failed', err));

    // Check and apply trust tier promotion
    const newTier = await promoteUserTrustTier(submitterId);
    if (newTier === 'BASIC' || newTier === 'TRUSTED') {
      sendTrustTierPromotedEmail(submitterId, newTier).catch((err) =>
        console.error('sendTrustTierPromotedEmail failed', err),
      );
    }
  } else {
    sendSubmissionRejectedEmail(
      submitterId,
      entityName,
      submissionId,
      rejectionReason ?? null,
    ).catch((err) => console.error('sendSubmissionRejectedEmail failed', err));
  }
}
