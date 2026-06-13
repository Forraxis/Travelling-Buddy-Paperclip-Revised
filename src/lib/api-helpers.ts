import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { rateLimit } from './rate-limit';

export function parseSearchParams<T extends z.ZodType>(
  request: Request,
  schema: T,
): { data: z.infer<T> } | { error: NextResponse } {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      error: NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      ),
    };
  }
  return { data: result.data };
}

export function withRateLimit(request: Request): NextResponse | null {
  return rateLimit(request);
}

export function notFound(entity: string) {
  return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
}

export function serverError(err: unknown) {
  console.error(err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
