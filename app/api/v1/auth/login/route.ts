import { handleRoute, json, readJson } from "../../../../../lib/api";
import { firebaseAuth } from "../../../../../lib/firebase";
import { firestore } from "../../../../../lib/firebase";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJson(request);
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return json(
        {
          error: {
            code: "MISSING_FIELDS",
            message: "البريد الإلكتروني وكلمة المرور مطلوبان",
          },
        },
        400,
      );
    }

    try {
      // Verify credentials using Firebase Admin SDK
      const userRecord = await firebaseAuth().getUserByEmail(email);
      
      // Get user document from Firestore to check role
      const userDoc = await firestore().collection("users").doc(userRecord.uid).get();
      
      if (!userDoc.exists) {
        return json(
          {
            error: {
              code: "USER_NOT_FOUND",
              message: "المستخدم غير موجود في النظام",
            },
          },
          404,
        );
      }

      const userData = userDoc.data();
      const role = userData?.role;

      if (!role || (role !== "owner" && role !== "manager")) {
        return json(
          {
            error: {
              code: "INVALID_ROLE",
              message: "حسابك لم يُمنح دورًا في مركز سوا",
            },
          },
          403,
        );
      }

      // Generate custom token for the user
      const customToken = await firebaseAuth().createCustomToken(userRecord.uid);

      return json({
        success: true,
        data: {
          customToken,
          user: {
            id: userRecord.uid,
            email: userRecord.email,
            name: userData?.name || userRecord.displayName || "",
            role,
            branchId: userData?.branchId || null,
          },
        },
      });
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        return json(
          {
            error: {
              code: "INVALID_CREDENTIALS",
              message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
            },
          },
          401,
        );
      }

      return json(
        {
          error: {
            code: "LOGIN_FAILED",
            message: "فشل تسجيل الدخول",
          },
        },
        500,
      );
    }
  });
}
