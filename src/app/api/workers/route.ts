import { NextResponse } from "next/server";
import { redis, queues } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ping = await redis.ping();
    const queueCounts = await Promise.all(
      queues.map(async (q) => ({
        name: q.name,
        counts: await q.getJobCounts(
          "active",
          "waiting",
          "completed",
          "failed"
        ),
      }))
    );

    return NextResponse.json({
      status: "ok",
      redis: ping === "PONG" ? "connected" : "error",
      queues: queueCounts,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: String(err) },
      { status: 500 }
    );
  }
}
