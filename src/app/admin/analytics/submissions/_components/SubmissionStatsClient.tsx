'use client';

import dynamic from 'next/dynamic';
import type { SubmissionStatsData } from './SubmissionStatsView';

// recharts 3.x imports victory-vendor via wildcard exports (./d3-*) which
// Turbopack cannot resolve at compile time, hanging the dev server. Load
// client-side only to keep recharts out of the server compilation graph.
// `ssr: false` is only allowed inside a Client Component (Next 16), so this
// wrapper exists purely to host the dynamic import for the server page.
const SubmissionStatsView = dynamic(
  () => import('./SubmissionStatsView').then((m) => m.SubmissionStatsView),
  { ssr: false },
);

export function SubmissionStatsClient({ data }: { data: SubmissionStatsData }) {
  return <SubmissionStatsView data={data} />;
}
