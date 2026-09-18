import {
  badRequest,
  handleRoute,
  json,
  readJson,
} from "../../../../../../lib/api";
import {
  assertBranchAccess,
  requireUser,
} from "../../../../../../lib/auth";
import {
  createPayment,
  getStudent,
  listPayments,
} from "../../../../../../lib/firestore";
import {
  createPaymentSchema,
  parseBody,
} from "../../../../../../lib/validation";

type Context = {
  params: Promise<{ id: string }>;
};

type PaymentInput = {
  method: "cash" | "sham_cash";
  receiptFileName?: string;
  receiptUrl?: string;
};

function validatePayment(payment: PaymentInput) {
  if (payment.method === "cash") {
    return;
  }

  if (payment.method === "sham_cash") {
    // إيصال شام كاش اختياري.
    if (
      payment.receiptFileName &&
      !/\.pdf$/i.test(payment.receiptFileName)
    ) {
      throw badRequest("إيصال شام كاش يجب أن يكون بصيغة PDF");
    }

    if (
      payment.receiptUrl &&
      !/\.pdf(?:$|\?)/i.test(payment.receiptUrl)
    ) {
      throw badRequest("رابط إيصال شام كاش يجب أن يشير إلى ملف PDF");
    }

    return;
  }

  throw badRequest("طريقة الدفع غير مدعومة");
}

export async function GET(
  request: Request,
  context: Context,
) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const { id } = await context.params;

    const student = await getStudent(id);

    assertBranchAccess(user, student.branchId);

    return json({
      items: await listPayments(id),
    });
  });
}

export async function POST(
  request: Request,
  context: Context,
) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    const { id } = await context.params;

    const student = await getStudent(id);

    assertBranchAccess(user, student.branchId);

    const input = parseBody(
      createPaymentSchema,
      await readJson(request),
    );

    validatePayment(input);

    if (input.amount > student.totalFee) {
      throw badRequest(
        "لا يمكن أن تتجاوز الدفعة إجمالي رسوم الدورة",
      );
    }

    const payment = await createPayment({
      studentId: id,
      ...input,
      totalFee: student.totalFee,
    });

    return json(
      {
        payment,
      },
      201,
    );
  });
}