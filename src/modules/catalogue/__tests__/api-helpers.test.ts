import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { parseSearchParams } from "@/lib/api-helpers";

const testSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().optional(),
});

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("parseSearchParams", () => {
  it("parses valid params", () => {
    const req = makeRequest("http://localhost/api?q=test&limit=5");
    const result = parseSearchParams(req, testSchema);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data).toEqual({ q: "test", limit: 5 });
    }
  });

  it("returns error for invalid params", () => {
    const req = makeRequest("http://localhost/api?q=");
    const result = parseSearchParams(req, testSchema);
    expect("error" in result).toBe(true);
  });

  it("returns error for missing required params", () => {
    const req = makeRequest("http://localhost/api");
    const result = parseSearchParams(req, testSchema);
    expect("error" in result).toBe(true);
  });

  it("returns 400 status for validation errors", async () => {
    const req = makeRequest("http://localhost/api?q=");
    const result = parseSearchParams(req, testSchema);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      const body = await result.error.json();
      expect(body.error).toBe("Invalid request parameters");
      expect(body.details).toBeInstanceOf(Array);
      expect(body.details.length).toBeGreaterThan(0);
    }
  });
});
