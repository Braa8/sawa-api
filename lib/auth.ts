import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextRequest } from "next/server";

import { ApiError, forbidden, unauthorized } from "./api";
import { firebaseAuth, firestore } from "./firebase";

export type UserRole = "owner" | "manager";

export type RequestUser = {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  branchId: string | null;
};

function tokenFromRequest(request: NextRequest): string {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) throw unauthorized();
  const token = value.slice("Bearer ".length).trim();
  if (!token) throw unauthorized();
  return token;
}

function roleFromToken(decoded: DecodedIdToken): UserRole | null {
  const role = decoded.role;
  return role === "owner" || role === "manager" ? role : null;
}

export async function requireUser(request: NextRequest): Promise<RequestUser> {
  let decoded: DecodedIdToken;
  try {
    decoded = await firebaseAuth().verifyIdToken(tokenFromRequest(request));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unauthorized("رمز الدخول غير صالح أو منتهي الصلاحية");
  }

  const profileSnapshot = await firestore()
    .collection("users")
    .doc(decoded.uid)
    .get();
  const profile = profileSnapshot.data() ?? {};
  const role = roleFromToken(decoded) ?? (
    profile.role === "owner" || profile.role === "manager"
      ? profile.role
      : null
  );

  if (!role) {
    throw forbidden("حسابك لم يُمنح دورًا في مركز سوا");
  }

  return {
    id: decoded.uid,
    email: decoded.email ?? null,
    name: String(profile.name ?? decoded.name ?? decoded.email ?? "مستخدم"),
    role,
    branchId: profile.branchId
      ? String(profile.branchId)
      : decoded.branchId
        ? String(decoded.branchId)
        : null,
  };
}

export function requireOwner(user: RequestUser) {
  if (user.role !== "owner") {
    throw forbidden("هذا الإجراء متاح للمالك فقط");
  }
}

export function assertBranchAccess(user: RequestUser, branchId: string) {
  if (user.role === "owner") return;
  if (!user.branchId || user.branchId !== branchId) {
    throw forbidden("لا يمكنك الوصول إلى بيانات هذا الفرع");
  }
}

export function scopedBranchId(user: RequestUser, requested?: string | null) {
  if (user.role === "owner") return requested ?? undefined;
  if (!user.branchId) throw forbidden("حساب المدير غير مرتبط بفرع");
  if (requested && requested !== user.branchId) {
    throw forbidden("لا يمكنك الوصول إلى بيانات فرع آخر");
  }
  return user.branchId;
}