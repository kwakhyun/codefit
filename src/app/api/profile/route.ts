import { getAuth } from "@/lib/server/auth";
import { profileSchema } from "@/lib/server/auth-config";
import { requireUser } from "@/lib/server/session";
import { getStore } from "@/lib/server/database";
import { failure, json, readBody } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { user, owner } = await requireUser(request);
    const auth = (await getAuth())!;
    const [accounts, usage, workspace] = await Promise.all([
      auth.api.listUserAccounts({ headers: request.headers }),
      (await getStore()).queries.usage(owner),
      (await getStore()).queries.workspace(owner),
    ]);
    return json({
      user,
      linkedProviders: accounts.map((account) => account.providerId),
      usage,
      stats: workspace.stats,
      training: workspace.training,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    await requireUser(request);
    const input = await readBody(request, profileSchema, 2000);
    const auth = (await getAuth())!;
    await auth.api.updateUser({ headers: request.headers, body: input });
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
