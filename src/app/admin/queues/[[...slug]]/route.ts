import { NextRequest, NextResponse } from "next/server";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { submissionVlmQueue, photoPostprocessQueue } from "@/lib/queue";
import { NextJsServerAdapter } from "@/lib/bull-board-adapter";
import { getAdminUser, isAdminOrModerator } from "@/modules/admin/lib/auth";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/queues";

const serverAdapter = new NextJsServerAdapter().setBasePath(BASE_PATH);

createBullBoard({
  queues: [
    new BullMQAdapter(submissionVlmQueue),
    new BullMQAdapter(photoPostprocessQueue),
  ],
  serverAdapter,
});

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> }
): Promise<NextResponse> {
  const user = getAdminUser();
  if (!isAdminOrModerator(user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { slug } = await params;
  return serverAdapter.handleRequest(req, slug ?? []);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
