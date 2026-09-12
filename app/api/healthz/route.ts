import { json } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    status: "ok",
    service: "sawa-api",
    timestamp: new Date().toISOString(),
  });
}