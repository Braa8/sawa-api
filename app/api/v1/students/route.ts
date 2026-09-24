import {
  badRequest,
  handleRoute,
  json,
  readJson,
} from "../../../../lib/api";

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

import {
  createStudentSchema,
  parseBody,
  parseQueryNumber,
} from "../../../../lib/validation";

type PaymentInput = {
  currency: "SYP" | "USD";
  method: "cash" | "sham_cash";
  amount: number;
  receiptFileName?: string;
  receiptUrl?: string;
};

function validateFirstPayment(
  payment: PaymentInput,
) {
  // الكاش لا يحتاج إيصالًا.
  if (payment.method === "cash") {
    return;
  }

  // شام كاش: الإيصال اختياري.
  // إذا أُرسل، يجب أن يكون PDF.
  if (payment.method === "sham_cash") {
    if (
      payment.receiptFileName &&
      !/\.pdf$/i.test(payment.receiptFileName)
    ) {
      throw badRequest(
        "إيصال شام كاش يجب أن يكون بصيغة PDF",
      );
    }

    if (
      payment.receiptUrl &&
      !/\.pdf(?:$|\?)/i.test(payment.receiptUrl)
    ) {
      throw badRequest(
        "رابط إيصال شام كاش يجب أن يشير إلى ملف PDF",
      );
    }

    return;
  }

  throw badRequest("طريقة الدفع غير مدعومة");
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);

    const url = new URL(request.url);

    const branchId = scopedBranchId(
      user,
      url.searchParams.get("branchId"),
    );

    const result = await listStudents({
      branchId,

      search:
        url.searchParams.get("search") ??
        undefined,

      limit: parseQueryNumber(
        url.searchParams.get("limit"),
        25,
        1,
        100,
      ),

      offset: parseQueryNumber(
        url.searchParams.get("offset"),
        0,
        0,
        100000,
      ),
    });

    return json(result);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);

    const input = parseBody(
      createStudentSchema,
      await readJson(request),
    );

    assertBranchAccess(
      user,
      input.branchId,
    );

    await getBranch(input.branchId);

    validateFirstPayment(
      input.firstPayment,
    );

    if (
      input.firstPayment.currency !==
      input.currency
    ) {
      throw badRequest(
        "عملة الدفعة يجب أن تطابق عملة رسوم الدورة",
      );
    }

    if (
      input.firstPayment.amount >
      input.totalFee
    ) {
      throw badRequest(
        "لا يمكن أن تتجاوز الدفعة الأولى إجمالي رسوم الدورة",
      );
    }

    const result =
      await createStudentWithPayment(input);

    return json(result, 201);
  });
}