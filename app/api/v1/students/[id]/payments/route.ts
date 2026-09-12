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
  PaymentRecord,
} from "../../../../../../lib/firestore";
import { createPaymentSchema, parseBody } from "../../../../../../lib/validation";

type Context = { params: Promise<{ id: string }> };

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
    const paid = (await listPayments(id)).reduce(
      (sum: number, payment: PaymentRecord) => sum + payment.amount,
      0,
    );
    if (paid + input.amount > student.totalFee) {
      throw badRequest("لا يمكن أن يتجاوز مجموع الدفعات رسوم الدورة");
    }
    return json(
      {
        payment: await createPayment({
          studentId: id,
          ...input,
        }),
      },
      201,
    );
  });
}