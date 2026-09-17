import { handleRoute, json } from "../../../../lib/api";
import { requireUser, scopedBranchId } from "../../../../lib/auth";
import { listPaymentsByBranch } from "../../../../lib/firestore";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const url = new URL(request.url);
    const branchId = scopedBranchId(user, url.searchParams.get("branchId"));
    return json({ items: await listPaymentsByBranch(branchId) });
  });
}
