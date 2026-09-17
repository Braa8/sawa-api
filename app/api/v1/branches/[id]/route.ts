import { handleRoute, json, readJson } from "../../../../../lib/api";
import { requireOwner, requireUser } from "../../../../../lib/auth";
import {
  deleteBranch,
  updateBranch,
} from "../../../../../lib/firestore";
import { parseBody, updateBranchSchema } from "../../../../../lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    requireOwner(user);
    const { id } = await context.params;
    const input = parseBody(updateBranchSchema, await readJson(request));
    return json({ branch: await updateBranch(id, input) });
  });
}

export async function DELETE(request: Request, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    requireOwner(user);
    const { id } = await context.params;
    await deleteBranch(id);
    return json({ success: true });
  });
}