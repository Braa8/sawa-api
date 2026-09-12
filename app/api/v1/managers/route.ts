import { handleRoute, json, readJson } from "../../../../lib/api";
import { requireOwner, requireUser } from "../../../../lib/auth";
import { listManagers, upsertManager } from "../../../../lib/firestore";
import { createManagerSchema, parseBody } from "../../../../lib/validation";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    requireOwner(user);
    return json({ items: await listManagers() });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    requireOwner(user);
    const input = parseBody(createManagerSchema, await readJson(request));
    return json({ manager: await upsertManager(input) }, 201);
  });
}