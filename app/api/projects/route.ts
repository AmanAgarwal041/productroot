import { NextResponse } from "next/server";
import { validateProjectInput } from "@/lib/core/project";
import { handle, InputError, requireCaller } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { createProject, listProjects } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** GET /api/projects: the workspace's projects. */
export function GET(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    return NextResponse.json({ projects: await listProjects(await getDb(), caller) });
  });
}

/** POST /api/projects: create a project. Body: ProjectInput. */
export function POST(req: Request) {
  return handle(async () => {
    const caller = await requireCaller(req);
    const v = validateProjectInput(await req.json().catch(() => null));
    if (!v.ok) throw new InputError(v.error);
    const project = await createProject(await getDb(), caller, v.value);
    return NextResponse.json({ project }, { status: 201 });
  });
}
