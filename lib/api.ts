import { NextResponse } from "next/server";


export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export async function handleRoute(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return json(
        {
          error: {
            code: error.name,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
        },
        error.status,
      );
    }

    return json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "حدث خطأ غير متوقع في الخادم",
        },
      },
      500,
    );
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "صيغة JSON غير صحيحة");
  }
}

export function notFound(message = "العنصر المطلوب غير موجود") {
  return new ApiError(404, message);
}

export function badRequest(message: string, details?: unknown) {
  return new ApiError(400, message, details);
}

export function unauthorized(message = "يجب تسجيل الدخول للوصول إلى هذا المسار") {
  return new ApiError(401, message);
}

export function forbidden(message = "ليس لديك صلاحية لتنفيذ هذا الإجراء") {
  return new ApiError(403, message);
}