import { render } from '@react-email/render';
import { resend, FROM_EMAIL } from './client';
import { SubmissionApprovedEmail } from './templates/submission-approved';
import { SubmissionRejectedEmail } from './templates/submission-rejected';
import { TrustTierPromotedEmail } from './templates/trust-tier-promoted';
import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3070';

interface NotificationPreferences {
  submissionApproved?: boolean;
  submissionRejected?: boolean;
  trustTierPromoted?: boolean;
}

async function getUserEmailAndPrefs(
  userId: string,
): Promise<{ email: string | null; prefs: NotificationPreferences }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPreferences: true },
  });

  const defaults: NotificationPreferences = {
    submissionApproved: true,
    submissionRejected: true,
    trustTierPromoted: true,
  };

  const stored =
    typeof user?.notificationPreferences === 'object' &&
    user.notificationPreferences !== null
      ? (user.notificationPreferences as NotificationPreferences)
      : {};

  return {
    email: user?.email ?? null,
    prefs: { ...defaults, ...stored },
  };
}

export async function sendSubmissionApprovedEmail(
  userId: string,
  entityName: string,
  catalogueUrl: string,
): Promise<void> {
  const { email, prefs } = await getUserEmailAndPrefs(userId);
  if (!email || prefs.submissionApproved === false) return;

  const html = await render(
    SubmissionApprovedEmail({ entityName, catalogueUrl, siteUrl: SITE_URL }),
  );

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your submission for ${entityName} has been approved`,
    html,
  });
}

export async function sendSubmissionRejectedEmail(
  userId: string,
  entityName: string,
  submissionId: string,
  rejectionReason: string | null,
): Promise<void> {
  const { email, prefs } = await getUserEmailAndPrefs(userId);
  if (!email || prefs.submissionRejected === false) return;

  const editUrl = `/account/submissions`;
  const html = await render(
    SubmissionRejectedEmail({
      entityName,
      rejectionReason,
      editUrl,
      siteUrl: SITE_URL,
    }),
  );

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Update needed for your ${entityName} submission`,
    html,
  });
}

export async function sendTrustTierPromotedEmail(
  userId: string,
  newTier: 'BASIC' | 'TRUSTED',
): Promise<void> {
  const { email, prefs } = await getUserEmailAndPrefs(userId);
  if (!email || prefs.trustTierPromoted === false) return;

  const html = await render(
    TrustTierPromotedEmail({ newTier, siteUrl: SITE_URL }),
  );

  const tierLabel = newTier === 'BASIC' ? 'Contributor' : 'Trusted';

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `You have been promoted to ${tierLabel} on TravellingBuddy`,
    html,
  });
}
