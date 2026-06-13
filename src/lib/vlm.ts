/**
 * VLM client for Qwen3.6-35B-A3B served via OpenAI-compatible API.
 * Reachable from production VPS via Cloudflare Tunnel (no inbound port exposure).
 */

export interface VlmExtractionField {
  value: string | number | null;
  confidence: number; // 0–1
  source: 'plate' | 'form' | 'inferred';
}

export interface VlmExtractionResult {
  fields: Record<string, VlmExtractionField>;
  discrepancies: Array<{
    field: string;
    extractedValue: string | number | null;
    submittedValue: string | number | null;
    severity: 'minor' | 'major';
  }>;
}

export type VlmRecommendedAction =
  | 'auto_approve'
  | 'queue_for_review'
  | 'auto_reject';

export interface VlmGatekeeperResult {
  recommendedAction: VlmRecommendedAction;
  confidence: number; // 0–1
  plateAuthenticity: {
    assessment: 'genuine' | 'suspicious' | 'unclear';
    reasoning: string;
  };
  valuePlausibility: {
    assessment: 'plausible' | 'implausible' | 'unclear';
    reasoning: string;
  };
  anomalyFlags: string[];
  duplicateSuggestions: string[];
  reasoning: string;
}

export interface VlmSubmissionAnalysis {
  extraction: VlmExtractionResult;
  gatekeeper: VlmGatekeeperResult;
}

function getClient(): { baseUrl: string; apiKey: string; model: string } {
  const baseUrl = process.env.VLM_ENDPOINT_URL ?? process.env.VLM_API_URL;
  const apiKey = process.env.VLM_API_KEY ?? 'none';
  const model = process.env.VLM_MODEL ?? 'Qwen/Qwen3-35B-A3B';

  if (!baseUrl) {
    throw new Error('VLM_API_URL is not configured');
  }

  return { baseUrl, apiKey, model };
}

const VEHICLE_SYSTEM_PROMPT = `You are an automotive compliance plate analyser. You receive a compliance plate photo and form data submitted by a user claiming to describe a vehicle variant. Return ONLY valid JSON — no prose, no markdown fences.`;

const VEHICLE_USER_PROMPT_TEMPLATE = (
  submittedData: Record<string, unknown>,
) => `Analyse the compliance plate photo. The user submitted these values:

${JSON.stringify(submittedData, null, 2)}

Return a JSON object with exactly two keys:
1. "extraction": { "fields": { <fieldName>: { "value": <value|null>, "confidence": <0-1>, "source": "plate"|"form"|"inferred" } }, "discrepancies": [ { "field": ..., "extractedValue": ..., "submittedValue": ..., "severity": "minor"|"major" } ] }
2. "gatekeeper": { "recommendedAction": "auto_approve"|"queue_for_review"|"auto_reject", "confidence": <0-1>, "plateAuthenticity": { "assessment": "genuine"|"suspicious"|"unclear", "reasoning": "..." }, "valuePlausibility": { "assessment": "plausible"|"implausible"|"unclear", "reasoning": "..." }, "anomalyFlags": [...], "duplicateSuggestions": [...], "reasoning": "..." }`;

const CARAVAN_SYSTEM_PROMPT = `You are a caravan compliance plate analyser. Caravan plates lack a standard format — extract whatever values are visible and assess authenticity. Return ONLY valid JSON.`;

const ACCESSORY_SYSTEM_PROMPT = `You are an accessory photo analyser. Compare the submitted photo against existing entries and assess visual similarity. Return ONLY valid JSON.`;

const ACCESSORY_USER_PROMPT_TEMPLATE = (
  submittedData: Record<string, unknown>,
  hasPhoto: boolean,
) => `Analyse the ${hasPhoto ? 'accessory photo' : 'submitted data (no photo provided)'}. The user submitted:

${JSON.stringify(submittedData, null, 2)}

Return a JSON object with key "similarityResult": { "hasPotentialDuplicate": boolean, "similarity": <0-1>, "reasoning": "..." }`;

export async function analyseVehicleSubmission(
  photoBase64: string | null,
  photoMimeType: string,
  submittedData: Record<string, unknown>,
): Promise<VlmSubmissionAnalysis> {
  const { baseUrl, apiKey, model } = getClient();

  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'system', content: VEHICLE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: photoBase64
        ? [
            {
              type: 'image_url',
              image_url: {
                url: `data:${photoMimeType};base64,${photoBase64}`,
              },
            },
            {
              type: 'text',
              text: VEHICLE_USER_PROMPT_TEMPLATE(submittedData),
            },
          ]
        : VEHICLE_USER_PROMPT_TEMPLATE(submittedData),
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
      // Enable thinking mode for better structured reasoning
      thinking: { type: 'enabled', budget_tokens: 1024 },
    }),
    signal: AbortSignal.timeout(120_000), // 2-minute timeout
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VLM API error ${response.status}: ${text}`);
  }

  const completion = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = completion.choices[0]?.message?.content ?? '{}';

  // Strip any markdown fences the model may have added despite instruction
  const cleaned = content
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '');
  return JSON.parse(cleaned) as VlmSubmissionAnalysis;
}

export async function analyseCaravanSubmission(
  photoBase64: string | null,
  photoMimeType: string,
  submittedData: Record<string, unknown>,
): Promise<VlmSubmissionAnalysis> {
  const { baseUrl, apiKey, model } = getClient();

  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'system', content: CARAVAN_SYSTEM_PROMPT },
    {
      role: 'user',
      content: photoBase64
        ? [
            {
              type: 'image_url',
              image_url: {
                url: `data:${photoMimeType};base64,${photoBase64}`,
              },
            },
            {
              type: 'text',
              text: VEHICLE_USER_PROMPT_TEMPLATE(submittedData),
            },
          ]
        : VEHICLE_USER_PROMPT_TEMPLATE(submittedData),
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
      thinking: { type: 'enabled', budget_tokens: 1024 },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VLM API error ${response.status}: ${text}`);
  }

  const completion = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = completion.choices[0]?.message?.content ?? '{}';
  const cleaned = content
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '');
  return JSON.parse(cleaned) as VlmSubmissionAnalysis;
}

export async function analyseAccessorySubmission(
  photoBase64: string | null,
  photoMimeType: string,
  submittedData: Record<string, unknown>,
): Promise<{
  similarityResult: {
    hasPotentialDuplicate: boolean;
    similarity: number;
    reasoning: string;
  };
}> {
  const { baseUrl, apiKey, model } = getClient();

  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'system', content: ACCESSORY_SYSTEM_PROMPT },
    {
      role: 'user',
      content: photoBase64
        ? [
            {
              type: 'image_url',
              image_url: {
                url: `data:${photoMimeType};base64,${photoBase64}`,
              },
            },
            {
              type: 'text',
              text: ACCESSORY_USER_PROMPT_TEMPLATE(submittedData, true),
            },
          ]
        : ACCESSORY_USER_PROMPT_TEMPLATE(submittedData, false),
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VLM API error ${response.status}: ${text}`);
  }

  const completion = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = completion.choices[0]?.message?.content ?? '{}';
  const cleaned = content
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '');
  return JSON.parse(cleaned);
}
