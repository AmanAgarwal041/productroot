import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR or data cache is used (pages are static or fully dynamic).
export default defineCloudflareConfig({});
