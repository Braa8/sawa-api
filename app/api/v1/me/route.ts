import { handleRoute, json } from "../../../../lib/api";
import { requireUser } from "../../../../lib/auth";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request as never);
    return json({ user });
  });
}