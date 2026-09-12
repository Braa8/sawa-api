import { handleRoute, json, readJson } from "../../../../lib/api";
import { requireOwner, requireUser, scopedBranchId } from "../../../../lib/auth";
import {
  createBranch,
  listBranches,
} from "../../../../lib/firestore";
import { createBranchSchema, parseBody } from "../../../../lib/validation";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const url = new URL(request.url);
    const branchId = scopedBranchId(user, url.searchParams.get("branchId"));
    return json({ items: await listBranches(branchId) });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    requireOwner(user);
    const input = parseBody(createBranchSchema, await readJson(request));
    return json({ branch: await createBranch(input) }, 201);
  });
}