/**
 * Async worker for the QWEN/CLAUDE vehicle-spec fetch path. Mirrors the VLM
 * worker (in-process via instrumentation, ioredis connection, concurrency cap).
 *
 * ⚠️ SAFETY GATE: this worker calls a real model and persists its output, so it
 * is HARD-GATED behind SPEC_FETCH_LIVE_ENABLED === 'true'. With the flag unset
 * (the default, and the state tonight) it records a fetchError and writes NO
 * fields — so even an accidentally-enqueued job cannot seed hallucinated data.
 * The MOCK provider runs synchronously in the server action and never touches
 * this queue.
 *
 * TODO(tim): to enable live fetches — (1) set SPEC_FETCH_LIVE_ENABLED=true,
 * (2) have the admin action enqueue here for QWEN/CLAUDE instead of rejecting,
 * (3) prefer the grounded CLAUDE provider for REAL data (qwen is ungrounded and
 * hallucinates — keep its output admin-gated regardless).
 */
import { Worker, type Job } from 'bullmq';
import { redis } from '@/lib/queue';
import { prisma } from '@/lib/db';
import {
  getSpecFetchProvider,
  isComplianceCriticalField,
  type SpecFetchInput,
  type SpecFetchProviderId,
} from '@/lib/spec-fetch';

export interface SpecFetchJobData {
  candidateId: string;
  providerId: SpecFetchProviderId;
  input: SpecFetchInput;
}

function liveEnabled(): boolean {
  return process.env.SPEC_FETCH_LIVE_ENABLED === 'true';
}

/**
 * Testable job core. Returns a short status string. Persists fields ONLY when
 * the live gate is open AND the provider returns successfully.
 */
export async function runSpecFetchJob(data: SpecFetchJobData): Promise<string> {
  const { candidateId, providerId, input } = data;

  if (providerId === 'MOCK') {
    // Mock never uses the queue; if it somehow gets here, treat as a no-op.
    return 'skipped: mock provider does not use the queue';
  }

  if (!liveEnabled()) {
    await prisma.vehicleSpecCandidate.update({
      where: { id: candidateId },
      data: {
        fetchError:
          'Live spec fetch is disabled (SPEC_FETCH_LIVE_ENABLED is not set). ' +
          'No model was called; no fields were written.',
      },
    });
    return 'gated: live fetch disabled';
  }

  try {
    const provider = getSpecFetchProvider(providerId);
    const result = await provider.fetchVehicleSpec(input);
    await prisma.$transaction(async (tx) => {
      // Replace any prior fields for this candidate, then write the fresh set.
      await tx.vehicleSpecCandidateField.deleteMany({ where: { candidateId } });
      await tx.vehicleSpecCandidate.update({
        where: { id: candidateId },
        data: {
          provider: result.provider,
          providerModel: result.providerModel,
          promptVersion: result.promptVersion,
          rawResponse: JSON.parse(JSON.stringify(result.raw)),
          fetchError: null,
          fields: {
            create: result.fields.map((f) => ({
              field: f.field,
              value: f.value,
              confidence: f.confidence,
              sourceUrl: f.sourceUrl,
              provider: result.provider,
              isComplianceCritical: isComplianceCriticalField(f.field),
            })),
          },
        },
      });
    });
    return `ok: ${result.fields.length} fields`;
  } catch (err) {
    await prisma.vehicleSpecCandidate.update({
      where: { id: candidateId },
      data: {
        fetchError: err instanceof Error ? err.message : String(err),
      },
    });
    return 'error';
  }
}

export function createSpecFetchWorker(): Worker<SpecFetchJobData> {
  return new Worker<SpecFetchJobData>(
    'spec-fetch',
    async (job: Job<SpecFetchJobData>) => runSpecFetchJob(job.data),
    { connection: redis, concurrency: 1 },
  );
}
