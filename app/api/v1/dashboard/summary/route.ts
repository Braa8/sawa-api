import { handleRoute, json } from "../../../../../lib/api";

import {
  requireUser,
  scopedBranchId,
} from "../../../../../lib/auth";

import {
  dashboardSummary,
} from "../../../../../lib/firestore";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);

    const url = new URL(request.url);

    const branchId = scopedBranchId(
      user,
      url.searchParams.get("branchId"),
    );

    const branches = await dashboardSummary(branchId);

    const totals = branches.reduce(
      (result, item) => ({
        students:
          result.students +
          item.studentsCount,

        // نحافظ على الحقل القديم collected
        // ليبقى متوافقاً مع الواجهة الحالية،
        // وهو يمثل الليرة السورية.
        collected:
          result.collected +
          item.collected,

        expenses:
          result.expenses +
          item.expenses.SYP,

        net:
          result.net +
          item.net.SYP,

        // إجماليات العملتين.
        collectedByCurrency: {
          SYP:
            result.collectedByCurrency.SYP +
            item.collectedByCurrency.SYP,

          USD:
            result.collectedByCurrency.USD +
            item.collectedByCurrency.USD,
        },

        expensesByCurrency: {
          SYP:
            result.expensesByCurrency.SYP +
            item.expenses.SYP,

          USD:
            result.expensesByCurrency.USD +
            item.expenses.USD,
        },

        netByCurrency: {
          SYP:
            result.netByCurrency.SYP +
            item.net.SYP,

          USD:
            result.netByCurrency.USD +
            item.net.USD,
        },
      }),
      {
        students: 0,
        collected: 0,
        expenses: 0,
        net: 0,

        collectedByCurrency: {
          SYP: 0,
          USD: 0,
        },

        expensesByCurrency: {
          SYP: 0,
          USD: 0,
        },

        netByCurrency: {
          SYP: 0,
          USD: 0,
        },
      },
    );

    return json({
      branches,
      totals,
    });
  });
}