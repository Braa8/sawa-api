import { handleRoute, json, readJson } from "../../../../lib/api";
import { assertBranchAccess, requireUser, scopedBranchId } from "../../../../lib/auth";
import {
  createExpense,
  getBranch,
  listExpenses,
} from "../../../../lib/firestore";
import { createExpenseSchema, parseBody } from "../../../../lib/validation";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const url = new URL(request.url);
    const branchId = scopedBranchId(user, url.searchParams.get("branchId"));
    return json({ items: await listExpenses(branchId) });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const input = parseBody(createExpenseSchema, await readJson(request));
    assertBranchAccess(user, input.branchId);
    await getBranch(input.branchId);
    return json({ expense: await createExpense(input) }, 201);
  });
}