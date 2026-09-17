
import { handleRoute, json } from "../../../../../lib/api";
import { firebaseAuth, firestore } from "../../../../../lib/firebase";

export async function POST(request: Request) {
  return handleRoute(async () => {
    try {
      const authorization = request.headers.get("authorization");

      if (!authorization?.startsWith("Bearer ")) {
        return json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "لا يوجد حساب بهذه المعلومات",
            },
          },
          401,
        );
      }

      const idToken = authorization.substring("Bearer ".length).trim();

      if (!idToken) {
        return json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "رمز المصادقة غير صالح",
            },
          },
          401,
        );
      }

      // Verify the Firebase ID Token
      const decodedToken = await firebaseAuth().verifyIdToken(idToken);

      const uid = decodedToken.uid;

      // Get user document from Firestore
      const userDoc = await firestore()
        .collection("users")
        .doc(uid)
        .get();

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

      // User must have an assigned role
      if (role !== "owner" && role !== "manager") {
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

      const userRecord = await firebaseAuth().getUser(uid);

      return json({
        success: true,
        data: {
          user: {
            id: uid,
            email: userRecord.email,
            name:
              userData?.name ||
              userRecord.displayName ||
              "",
            role,
            branchId: userData?.branchId || null,
          },
        },
      });
    } catch (error: unknown) {
      console.error("Login verification error:", error);

      return json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: "جلسة تسجيل الدخول غير صالحة",
          },
        },
        401,
      );
    }
  });
}
