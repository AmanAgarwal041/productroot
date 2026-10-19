// The D1 database. Available on Cloudflare and in `next dev` (OpenNext's dev
// proxy runs a local D1 under .wrangler/state; apply migrations with
// `npm run db:migrate:local`).

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { InputError } from "./auth";

export async function getDb(): Promise<D1Database> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.DB) return env.DB;
  } catch {
    /* fall through */
  }
  throw new InputError("The database isn't available. Bind D1 as DB and run the migrations.", 503);
}
