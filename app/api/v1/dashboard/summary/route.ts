import { handleRoute, json } from "../../../../../lib/api";
import { requireUser, scopedBranchId } from "../../../../../lib/auth";
import { dashboardSummary } from "../../../../../lib/firestore";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const url = new URL(request.url);
    const branchId = scopedBranchId(user, url.searchParams.get("branchId"));
    const branches = await dashboardSummary(branchId);
    return json({
      branches,
      totals: branches.reduce(
        (result, item) => ({
          students: result.students + item.studentsCount,
          collected: result.collected + item.collected,
          expenses: result.expenses + item.expenses,
          net: result.net + item.net,
        }),
        { students: 0, collected: 0, expenses: 0, net: 0 },
      ),
    });
  });
}