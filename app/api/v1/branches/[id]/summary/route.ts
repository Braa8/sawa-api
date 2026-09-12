import { handleRoute, json } from "../../../../../../lib/api";
import { assertBranchAccess, requireUser } from "../../../../../../lib/auth";
import { dashboardSummary } from "../../../../../../lib/firestore";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const { id } = await context.params;
    assertBranchAccess(user, id);
    const [summary] = await dashboardSummary(id);
    return json({ summary });
  });
}