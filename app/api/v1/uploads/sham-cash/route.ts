import { put } from "@vercel/blob";

import { badRequest, handleRoute, json } from "../../../../../lib/api";
import { requireUser } from "../../../../../lib/auth";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireUser(request as never);
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return json(
        {
          error: {
            code: "STORAGE_NOT_CONFIGURED",
            message: "تخزين الإيصالات غير مهيأ بعد",
          },
        },
        503,
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw badRequest("أرسل ملف PDF في الحقل file");
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      throw badRequest("حجم الإيصال يتجاوز الحد المسموح وهو 5MB");
    }

    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const pdfSignature = "%PDF-";
    if (
      signature.length !== pdfSignature.length ||
      !signature.every((byte, index) => byte === pdfSignature.charCodeAt(index))
    ) {
      throw badRequest("الملف المرفوع ليس ملف PDF صالحاً");
    }

    const blob = await put(
      `sham-cash/${crypto.randomUUID()}-${safeFileName(file.name)}`,
      file,
      {
        // The current Blob SDK exposes public stores only. Keep the write behind
        // this authenticated API and replace with a private store before launch.
        access: "public",
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: "application/pdf",
      },
    );

    return json(
      {
        receipt: {
          url: blob.url,
          pathname: blob.pathname,
          contentType: blob.contentType,
          size: file.size,
          fileName: file.name,
        },
      },
      201,
    );
  });
}