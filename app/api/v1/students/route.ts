import { badRequest, handleRoute, json, readJson } from "../../../../lib/api";
import {
  assertBranchAccess,
  requireUser,
  scopedBranchId,
} from "../../../../lib/auth";
import {
  createStudentWithPayment,
  getBranch,
  listStudents,
} from "../../../../lib/firestore";
import { createStudentSchema, parseBody, parseQueryNumber } from "../../../../lib/validation";

function requireShamCashReceipt(input: {
  method: "cash" | "sham_cash";
  receiptFileName?: string;
  receiptUrl?: string;
}) {
  if (
    input.method === "sham_cash" &&
    !input.receiptFileName &&
    !input.receiptUrl
  ) {
    throw badRequest("إيصال PDF إلزامي عند اختيار شام كاش");
  }
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const url = new URL(request.url);
    const branchId = scopedBranchId(user, url.searchParams.get("branchId"));
    const result = await listStudents({
      branchId,
      search: url.searchParams.get("search") ?? undefined,
      limit: parseQueryNumber(url.searchParams.get("limit"), 25, 1, 100),
      offset: parseQueryNumber(url.searchParams.get("offset"), 0, 0, 100000),
    });
    return json(result);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const input = parseBody(createStudentSchema, await readJson(request));
    assertBranchAccess(user, input.branchId);
    await getBranch(input.branchId);
    requireShamCashReceipt(input.firstPayment);
    const result = await createStudentWithPayment(input);
    return json(result, 201);
  });
}