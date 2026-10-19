import type { ConnectionInfo } from "../connections";
import type { AdapterInfo } from "./contract";
import { metainfoInfo } from "./metainfo";
import { socialbreweryInfo } from "./socialbrewery";
import { uptimeInfo } from "./uptime";

export function githubInfo(conn: ConnectionInfo | undefined): AdapterInfo {
  const serverToken = !!process.env.GITHUB_TOKEN?.trim();
  return {
    id: "github",
    name: "GitHub",
    description: "Reads repositories to detect your stack and what's in place, and opens pull requests you approve.",
    appUrl: "https://github.com",
    configured: !!conn,
    note: conn
      ? `Connected as ${String(conn.meta.login ?? "unknown")} with a fine-grained token. Private repositories are readable; pull requests open only after approval and never touch the default branch.`
      : `Public repositories work without connecting${serverToken ? "" : " (60 requests/hour shared)"}. Connect a fine-grained token to read private repositories and open pull requests.`,
    capabilities: { connect: "integrated", discover: "integrated", read: "integrated", execute: conn ? "integrated" : "unsupported", verify: conn ? "integrated" : "unsupported" },
  };
}

export function allIntegrations(conns: ConnectionInfo[]): AdapterInfo[] {
  const by = (p: string) => conns.find((c) => c.provider === p);
  const sb = by("socialbrewery");
  return [
    githubInfo(by("github")),
    metainfoInfo(),
    socialbreweryInfo(sb ? { url: String(sb.meta.url) } : null),
    uptimeInfo(by("uptimerobot") ?? by("betterstack")),
  ];
}
