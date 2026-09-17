import { badRequest, handleRoute, json, readJson } from "../../../../lib/api";
import { firebaseAuth } from "../../../../lib/firebase";
import { requireOwner, requireUser } from "../../../../lib/auth";
import { listManagers, upsertManager } from "../../../../lib/firestore";
import { createManagerSchema, parseBody } from "../../../../lib/validation";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    requireOwner(user);
    return json({ items: await listManagers() });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    requireOwner(user);
    const input = parseBody(createManagerSchema, await readJson(request));
    let userRecord;
    try {
      userRecord = await firebaseAuth().getUserByEmail(input.email);
      throw badRequest("البريد الإلكتروني مستخدم بالفعل");
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ApiError") throw error;
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "auth/user-not-found"
      ) {
        throw error;
      }
      userRecord = await firebaseAuth().createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
      });
    }

    try {
      const manager = await upsertManager({
        userId: userRecord.uid,
        name: input.name,
        email: input.email,
        branchId: input.branchId,
      });
      return json({ manager }, 201);
    } catch (error) {
      await firebaseAuth().deleteUser(userRecord.uid).catch(() => undefined);
      throw error;
    }
  });
}