import { put } from "@vercel/blob";

import {
  badRequest,
  handleRoute,
  json,
} from "../../../../../lib/api";

import { requireUser } from "../../../../../lib/auth";

const MAX_IDENTITY_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-120);
}

function getExtension(file: File) {
  const type = file.type.toLowerCase();

  if (type === "image/jpeg") {
    return "jpg";
  }

  if (type === "image/png") {
    return "png";
  }

  const originalExtension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase();

  if (
    originalExtension === "jpg" ||
    originalExtension === "jpeg"
  ) {
    return "jpg";
  }

  if (originalExtension === "png") {
    return "png";
  }

  return null;
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireUser(request as never);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return json(
        {
          error: {
            code: "STORAGE_NOT_CONFIGURED",
            message:
              "تخزين الصور غير مهيأ بعد",
          },
        },
        503,
      );
    }

    const formData = await request.formData();

    const side = formData.get("side");
    const file = formData.get("file");

    if (
      side !== "front" &&
      side !== "back"
    ) {
      throw badRequest(
        "نوع صورة الهوية يجب أن يكون front أو back",
      );
    }

    if (!(file instanceof File)) {
      throw badRequest(
        "أرسل صورة الهوية في الحقل file",
      );
    }

    if (file.size <= 0) {
      throw badRequest(
        "صورة الهوية فارغة",
      );
    }

    if (
      file.size >
      MAX_IDENTITY_IMAGE_BYTES
    ) {
      throw badRequest(
        "حجم صورة الهوية يتجاوز الحد المسموح وهو 5MB",
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      throw badRequest(
        "صورة الهوية يجب أن تكون JPG أو JPEG أو PNG",
      );
    }

    const extension =
      getExtension(file);

    if (!extension) {
      throw badRequest(
        "امتداد صورة الهوية غير مدعوم",
      );
    }

    const blob = await put(
      `student-identities/${side}/${crypto.randomUUID()}-${safeFileName(file.name)}`,
      file,
      {
        access: "public",
        addRandomSuffix: false,
        token:
          process.env.BLOB_READ_WRITE_TOKEN,
        contentType: file.type,
      },
    );

    return json(
      {
        image: {
          side,
          url: blob.url,
          pathname: blob.pathname,
          contentType:
            blob.contentType,
          size: file.size,
          fileName: file.name,
        },
      },
      201,
    );
  });
}