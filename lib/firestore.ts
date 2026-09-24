import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";

import { badRequest, notFound } from "./api";
import { firestore } from "./firebase";

export type PaymentMethod = "cash" | "sham_cash";

export type PaymentCurrency = "SYP" | "USD";

export type BranchRecord = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
};

export type StudentRecord = {
  id: string;
  name: string;
  phone: string;
  branchId: string;
  course: string;
  totalFee: number;
  currency: PaymentCurrency;
  createdAt: string;
};

export type PaymentRecord = {
  id: string;
  studentId: string;
  amount: number;
  currency: PaymentCurrency;
  method: PaymentMethod;
  receiptFileName: string | null;
  receiptUrl: string | null;
  createdAt: string;
};

export type ExpenseRecord = {
  id: string;
  branchId: string;
  title: string;
  amount: number;
  currency: PaymentCurrency;
  date: string;
  createdAt: string;
};

export type ManagerRecord = {
  id: string;
  userId: string;
  name: string;
  email: string;
  branchId: string;
  role: "manager";
};

function isoDate(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}

function dateValue(value?: string) {
  return value ? Timestamp.fromDate(new Date(value)) : Timestamp.now();
}

function paymentCurrency(value: unknown): PaymentCurrency {
  return value === "USD" ? "USD" : "SYP";
}

export async function getBranch(branchId: string): Promise<BranchRecord> {
  const snapshot = await firestore().collection("branches").doc(branchId).get();

  if (!snapshot.exists) {
    throw notFound("الفرع غير موجود");
  }

  const data = snapshot.data() ?? {};

  return {
    id: snapshot.id,
    name: String(data.name ?? ""),
    address: String(data.address ?? ""),
    createdAt: isoDate(data.createdAt),
  };
}

export async function listBranches(branchId?: string) {
  const query = branchId
    ? firestore().collection("branches").where("__name__", "==", branchId)
    : firestore().collection("branches");

  const snapshot = await query.get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: String(data.name ?? ""),
        address: String(data.address ?? ""),
        createdAt: isoDate(data.createdAt),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export async function createBranch(input: {
  name: string;
  address: string;
}): Promise<BranchRecord> {
  const ref = firestore().collection("branches").doc();
  const createdAt = Timestamp.now();

  await ref.set({
    name: input.name,
    address: input.address,
    createdAt,
    updatedAt: createdAt,
  });

  return {
    id: ref.id,
    name: input.name,
    address: input.address,
    createdAt: createdAt.toDate().toISOString(),
  };
}

export async function updateBranch(
  branchId: string,
  input: { name?: string; address?: string },
): Promise<BranchRecord> {
  const ref = firestore().collection("branches").doc(branchId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw notFound("الفرع غير موجود");
  }

  await ref.update({
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.address === undefined ? {} : { address: input.address }),
    updatedAt: Timestamp.now(),
  });

  return getBranch(branchId);
}

export async function deleteBranch(branchId: string): Promise<void> {
  const ref = firestore().collection("branches").doc(branchId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw notFound("الفرع غير موجود");
  }

  const [students, expenses] = await Promise.all([
    firestore()
      .collection("students")
      .where("branchId", "==", branchId)
      .limit(1)
      .get(),
    firestore()
      .collection("expenses")
      .where("branchId", "==", branchId)
      .limit(1)
      .get(),
  ]);

  if (!students.empty || !expenses.empty) {
    throw badRequest("لا يمكن حذف فرع يحتوي على طلاب أو مصروفات");
  }

  await ref.delete();
}

function studentFromDoc(id: string, data: DocumentData): StudentRecord {
  return {
    id,
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    branchId: String(data.branchId ?? ""),
    course: String(data.course ?? ""),
    totalFee: Number(data.totalFee ?? 0),

    // السجلات القديمة التي لا تحتوي على currency تعتبر SYP.
    currency: paymentCurrency(data.currency),

    createdAt: isoDate(data.createdAt),
  };
}

export async function getStudent(studentId: string): Promise<StudentRecord> {
  const snapshot = await firestore()
    .collection("students")
    .doc(studentId)
    .get();

  if (!snapshot.exists) {
    throw notFound("الطالب غير موجود");
  }

  return studentFromDoc(snapshot.id, snapshot.data() ?? {});
}

export async function listStudents(input: {
  branchId?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
  const query = input.branchId
    ? firestore().collection("students").where("branchId", "==", input.branchId)
    : firestore().collection("students");

  const snapshot = await query.get();
  const normalizedSearch = input.search?.trim().toLocaleLowerCase("ar");

  const filtered = snapshot.docs
    .map((doc) => studentFromDoc(doc.id, doc.data()))
    .filter((student) => {
      if (!normalizedSearch) return true;

      return [student.name, student.phone, student.course]
        .join(" ")
        .toLocaleLowerCase("ar")
        .includes(normalizedSearch);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    items: filtered.slice(input.offset, input.offset + input.limit),
    total: filtered.length,
  };
}

function paymentFromDoc(id: string, data: DocumentData): PaymentRecord {
  return {
    id,
    studentId: String(data.studentId ?? ""),
    amount: Number(data.amount ?? 0),

    // السجلات القديمة التي لا تحتوي على currency تعتبر SYP.
    currency: paymentCurrency(data.currency),

    method: data.method === "sham_cash" ? "sham_cash" : "cash",

    receiptFileName: data.receiptFileName ? String(data.receiptFileName) : null,

    receiptUrl: data.receiptUrl ? String(data.receiptUrl) : null,

    createdAt: isoDate(data.createdAt),
  };
}

export async function listPayments(studentId?: string) {
  const query = studentId
    ? firestore().collection("payments").where("studentId", "==", studentId)
    : firestore().collection("payments");

  const snapshot = await query.get();

  return snapshot.docs
    .map((doc) => paymentFromDoc(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPaymentsByBranch(branchId?: string) {
  const query = branchId
    ? firestore().collection("payments").where("branchId", "==", branchId)
    : firestore().collection("payments");

  const snapshot = await query.get();

  return snapshot.docs
    .map((doc) => paymentFromDoc(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPaymentsForStudents(studentIds: Set<string>) {
  if (studentIds.size === 0) return [];

  const ids = Array.from(studentIds);
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += 30) {
    chunks.push(ids.slice(index, index + 30));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      firestore().collection("payments").where("studentId", "in", chunk).get(),
    ),
  );

  return snapshots
    .flatMap((snapshot) =>
      snapshot.docs.map((doc) => paymentFromDoc(doc.id, doc.data())),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createStudentWithPayment(input: {
  name: string;
  phone: string;
  branchId: string;
  course: string;
  totalFee: number;
  currency: PaymentCurrency;

  firstPayment: {
    amount: number;
    currency: PaymentCurrency;
    method: PaymentMethod;
    receiptFileName?: string;
    receiptUrl?: string;
  };
}) {
  if (input.firstPayment.currency !== input.currency) {
    throw badRequest("عملة الدفعة يجب أن تطابق عملة رسوم الدورة");
  }

  if (input.firstPayment.amount > input.totalFee) {
    throw badRequest("لا يمكن أن تتجاوز الدفعة الأولى إجمالي رسوم الدورة");
  }

  const db = firestore();
  const studentRef = db.collection("students").doc();
  const paymentRef = db.collection("payments").doc();
  const createdAt = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    transaction.set(studentRef, {
      name: input.name,
      phone: input.phone,
      branchId: input.branchId,
      course: input.course,
      totalFee: input.totalFee,
      currency: input.currency,
      createdAt,
      updatedAt: createdAt,
    });

    transaction.set(paymentRef, {
      studentId: studentRef.id,
      branchId: input.branchId,
      amount: input.firstPayment.amount,
      currency: input.firstPayment.currency,
      method: input.firstPayment.method,
      receiptFileName: input.firstPayment.receiptFileName ?? null,
      receiptUrl: input.firstPayment.receiptUrl ?? null,
      createdAt,
    });
  });

  return {
    student: {
      id: studentRef.id,
      name: input.name,
      phone: input.phone,
      branchId: input.branchId,
      course: input.course,
      totalFee: input.totalFee,
      currency: input.currency,
      createdAt: createdAt.toDate().toISOString(),
    } satisfies StudentRecord,

    payment: {
      id: paymentRef.id,
      studentId: studentRef.id,
      amount: input.firstPayment.amount,
      currency: input.firstPayment.currency,
      method: input.firstPayment.method,
      receiptFileName: input.firstPayment.receiptFileName ?? null,
      receiptUrl: input.firstPayment.receiptUrl ?? null,
      createdAt: createdAt.toDate().toISOString(),
    } satisfies PaymentRecord,
  };
}

export async function createPayment(input: {
  studentId: string;
  amount: number;
  currency: PaymentCurrency;
  method: PaymentMethod;
  totalFee: number;
  receiptFileName?: string;
  receiptUrl?: string;
}): Promise<PaymentRecord> {
  const db = firestore();
  const studentRef = db.collection("students").doc(input.studentId);

  const ref = db.collection("payments").doc();
  const createdAt = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const studentSnapshot = await transaction.get(studentRef);

    if (!studentSnapshot.exists) {
      throw notFound("الطالب غير موجود");
    }

    const studentData = studentSnapshot.data() ?? {};

    const studentCurrency = paymentCurrency(studentData.currency);

    if (input.currency !== studentCurrency) {
      throw badRequest("عملة الدفعة يجب أن تطابق عملة رسوم الدورة");
    }

    const paymentsSnapshot = await transaction.get(
      db.collection("payments").where("studentId", "==", input.studentId),
    );

    const paid = paymentsSnapshot.docs.reduce((sum, payment) => {
      const paymentData = payment.data();

      // البيانات القديمة تعتبر SYP.
      const paymentCurrencyValue = paymentCurrency(paymentData.currency);

      if (paymentCurrencyValue !== studentCurrency) {
        throw badRequest("توجد دفعة بعملة مختلفة عن عملة رسوم الدورة");
      }

      return sum + Number(paymentData.amount ?? 0);
    }, 0);

    if (paid + input.amount > input.totalFee) {
      throw badRequest("لا يمكن أن يتجاوز مجموع الدفعات رسوم الدورة");
    }

    transaction.set(ref, {
      studentId: input.studentId,
      branchId: String(studentData.branchId ?? ""),
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      receiptFileName: input.receiptFileName ?? null,
      receiptUrl: input.receiptUrl ?? null,
      createdAt,
    });
  });

  return {
    id: ref.id,
    studentId: input.studentId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    receiptFileName: input.receiptFileName ?? null,
    receiptUrl: input.receiptUrl ?? null,
    createdAt: createdAt.toDate().toISOString(),
  };
}

function expenseFromDoc(id: string, data: DocumentData): ExpenseRecord {
  return {
    id,
    branchId: String(data.branchId ?? ""),
    title: String(data.title ?? ""),
    amount: Number(data.amount ?? 0),

    // المصروفات القديمة التي لا تحتوي على currency
    // تعتبر SYP.
    currency: paymentCurrency(data.currency),

    date: isoDate(data.date),
    createdAt: isoDate(data.createdAt),
  };
}

export async function listExpenses(branchId?: string) {
  const query = branchId
    ? firestore().collection("expenses").where("branchId", "==", branchId)
    : firestore().collection("expenses");

  const snapshot = await query.get();

  return snapshot.docs
    .map((doc) => expenseFromDoc(doc.id, doc.data()))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function createExpense(input: {
  branchId: string;
  title: string;
  amount: number;
  currency: PaymentCurrency;
  date?: string;
}): Promise<ExpenseRecord> {
  const ref = firestore().collection("expenses").doc();

  const createdAt = Timestamp.now();

  await ref.set({
    branchId: input.branchId,
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    date: dateValue(input.date),
    createdAt,
  });

  return {
    id: ref.id,
    branchId: input.branchId,
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    date: dateValue(input.date).toDate().toISOString(),
    createdAt: createdAt.toDate().toISOString(),
  };
}

export async function listManagers(): Promise<ManagerRecord[]> {
  const snapshot = await firestore()
    .collection("users")
    .where("role", "==", "manager")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      userId: doc.id,
      name: String(data.name ?? ""),
      email: String(data.email ?? ""),
      branchId: String(data.branchId ?? ""),
      role: "manager",
    };
  });
}

export async function upsertManager(input: {
  userId: string;
  name: string;
  email: string;
  branchId: string;
}): Promise<ManagerRecord> {
  await getBranch(input.branchId);

  const ref = firestore().collection("users").doc(input.userId);

  await ref.set(
    {
      name: input.name,
      email: input.email,
      branchId: input.branchId,
      role: "manager",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    id: ref.id,
    userId: ref.id,
    name: input.name,
    email: input.email,
    branchId: input.branchId,
    role: "manager",
  };
}

export async function dashboardSummary(branchId?: string) {
  const branches = await listBranches(branchId);

  const studentsResult = await listStudents({
    branchId,
    limit: 10000,
    offset: 0,
  });

  const studentIds = new Set(studentsResult.items.map((student) => student.id));

  const payments = await listPaymentsForStudents(studentIds);

  const expenses = await listExpenses(branchId);

  return branches.map((branch) => {
    const branchStudentIds = new Set(
      studentsResult.items
        .filter((student) => student.branchId === branch.id)
        .map((student) => student.id),
    );

    const branchPayments = payments.filter((payment) =>
      branchStudentIds.has(payment.studentId),
    );

    const collectedByCurrency = branchPayments.reduce(
      (totals, payment) => {
        totals[payment.currency] += payment.amount;

        return totals;
      },
      {
        SYP: 0,
        USD: 0,
      } as Record<PaymentCurrency, number>,
    );

    const branchExpensesByCurrency = expenses
      .filter((expense) => expense.branchId === branch.id)
      .reduce(
        (totals, expense) => {
          totals[expense.currency] += expense.amount;

          return totals;
        },
        {
          SYP: 0,
          USD: 0,
        } as Record<PaymentCurrency, number>,
      );

    return {
      branch,

      studentsCount: branchStudentIds.size,

      collected: collectedByCurrency.SYP,

      collectedByCurrency,

      expenses: branchExpensesByCurrency,

      net: {
        SYP: collectedByCurrency.SYP - branchExpensesByCurrency.SYP,

        USD: collectedByCurrency.USD - branchExpensesByCurrency.USD,
      },
    };
  });
}
