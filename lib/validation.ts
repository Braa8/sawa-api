import { z } from "zod";

import { badRequest } from "./api";

export const paymentMethodSchema = z.enum(["cash", "sham_cash"]);

export const firstPaymentSchema = z.object({
  amount: z.number().positive(),
  method: paymentMethodSchema,

  receiptFileName: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().min(1).optional(),
  ),

  receiptUrl: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().url().optional(),
  ),
});

export const createStudentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(30),
  branchId: z.string().trim().min(1),
  course: z.string().trim().min(1).max(120),
  totalFee: z.number().positive(),
  firstPayment: firstPaymentSchema,
});

export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  method: paymentMethodSchema,

  receiptFileName: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().min(1).optional(),
  ),

  receiptUrl: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().url().optional(),
  ),
});

export const createExpenseSchema = z.object({
  branchId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(160),
  amount: z.number().positive(),
  date: z.string().datetime().optional(),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(2).max(240),
});

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    address: z.string().trim().min(2).max(240).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.address !== undefined,
  );

export const createManagerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(128),
  branchId: z.string().trim().min(1),
});

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw badRequest(
      "البيانات المرسلة غير صحيحة",
      result.error.flatten(),
    );
  }

  return result.data;
}

export function parseQueryNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (!value) return fallback;

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    return fallback;
  }

  return parsed;
}
