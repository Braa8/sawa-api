import { handleRoute, json, readJson } from "../../../../../lib/api";
import { firebaseAuth, firestore } from "../../../../../lib/firebase";
import { Timestamp } from "firebase-admin/firestore";

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJson(request);
    const { 
      email, 
      password, 
      name 
    } = body as { 
      email: string; 
      password: string; 
      name: string; 
    };

    if (!email || !password || !name) {
      return json(
        {
          error: {
            code: "MISSING_FIELDS",
            message: "البريد الإلكتروني وكلمة المرور والاسم مطلوبون",
          },
        },
        400,
      );
    }

    // Validate email format
    if (!emailRegex.test(email)) {
      return json(
        {
          error: {
            code: "INVALID_EMAIL",
            message: "تنسيق البريد الإلكتروني غير صحيح",
          },
        },
        400,
      );
    }

    if (password.length < 6) {
      return json(
        {
          error: {
            code: "WEAK_PASSWORD",
            message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
          },
        },
        400,
      );
    }

    try {
      // Check if user already exists
      try {
        await firebaseAuth().getUserByEmail(email);
        return json(
          {
            error: {
              code: "USER_EXISTS",
              message: "البريد الإلكتروني مستخدم بالفعل",
            },
          },
          400,
        );
      } catch (error: any) {
        // User not found, continue with registration
        if (error.code !== "auth/user-not-found") {
          throw error;
        }
      }

      // Create user in Firebase Auth
      const userRecord = await firebaseAuth().createUser({
        email,
        password,
        displayName: name,
      });

      // Create user document in Firestore without role (role will be assigned by owner later)
      const createdAt = Timestamp.now();
      const userDocRef = firestore().collection("users").doc(userRecord.uid);
      
      await firestore().runTransaction(async (transaction) => {
        transaction.set(userDocRef, {
          name,
          email,
          role: null, // No role assigned yet
          branchId: null, // No branch assigned yet
          createdAt,
          updatedAt: createdAt,
        });
      });

      return json(
        {
          success: true,
          data: {
            user: {
              id: userRecord.uid,
              email: userRecord.email,
              name,
              role: null,
              branchId: null,
            },
          },
        },
        201,
      );
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Don't expose sensitive error details to client
      return json(
        {
          error: {
            code: "REGISTRATION_FAILED",
            message: "فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.",
          },
        },
        500,
      );
    }
  });
}
