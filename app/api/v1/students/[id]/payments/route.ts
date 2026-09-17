import {
  badRequest,
  handleRoute,
  json,
  readJson,
} from "../../../../../../lib/api";
import { assertBranchAccess, requireUser } from "../../../../../../lib/auth";
import {
  createPayment,
  getStudent,
  listPayments,
} from "../../../../../../lib/firestore";
import { createPaymentSchema, parseBody } from "../../../../../../lib/validation";

type Context = { params: Promise<{ id: string }> };

function requireShamCashReceipt(input: {
  method: "cash" | "sham_cash";
  receiptFileName?: string;
  receiptUrl?: string;
}) {
  if (input.method !== "sham_cash") return;
  
  // Receipt is now optional for shamCash
  // Only validate if provided
  if (input.receiptFileName && !/\.pdf$/i.test(input.receiptFileName)) {
    throw badRequest("إيصال شام كاش يجب أن يكون بصيغة PDF");
  }
  if (input.receiptUrl && !/\.pdf(?:$|\?)/i.test(input.receiptUrl)) {
    throw badRequest("رابط إيصال شام كاش يجب أن يشير إلى ملف PDF");
  }
}

export async function GET(request: Request, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const { id } = await context.params;
    const student = await getStudent(id);
    assertBranchAccess(user, student.branchId);
    return json({ items: await listPayments(id) });
  });
}

export async function POST(request: Request, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const { id } = await context.params;
    const student = await getStudent(id);
    assertBranchAccess(user, student.branchId);
    const input = parseBody(createPaymentSchema, await readJson(request));
    requireShamCashReceipt(input);
    return json(
      {
        payment: await createPayment({
          studentId: id,
          ...input,
          totalFee: student.totalFee,
        }),
      },
      201,
    );
  });
}