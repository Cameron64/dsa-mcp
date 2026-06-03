import { z } from 'zod';
import { defineDsaTool, toTextResult, type DsaMcpTool } from './tool-types.js';

/**
 * Static snapshot of the Austin DSA hosting-infrastructure reference
 * (trimmed from the austindsa-infra skill). No credentials, no live calls.
 * Every cost figure is an ESTIMATE; the snapshot date is embedded in the
 * returned text so callers always know the age of the data.
 */
const INFRA_SNAPSHOT_DATE = '2026-05-31';

const INFRA_SNAPSHOT_HEADER = `Austin DSA hosting infrastructure reference — snapshot ${INFRA_SNAPSHOT_DATE}. DNS/providers verified via DNS+RDAP on that date; costs are ESTIMATES, never confirmed bills. Re-verify before any spend decision.`;

const INFRA_DNS_SECTION = `## Provider map (VERIFIED via DNS + RDAP, ${INFRA_SNAPSHOT_DATE})

| Hostname | Provider | What runs there | Compute access? |
| --- | --- | --- | --- |
| austindsa.org / www | Squarespace (A 198.185.159.144/.145) | Public member website | No — no-code, no server access |
| wiki.austindsa.org | DigitalOcean droplet (A 64.23.157.43, NOT Cloudflare-proxied) | Self-hosted Outline wiki | Yes — DO droplet |
| tools.austindsa.org | Cloudflare-proxied (origin hidden) | GeneralToolsWebsite Django app | Origin hidden behind Cloudflare |`;

const INFRA_HOSTING_SECTION = `## Architecture (VERIFIED from the GeneralToolsWebsite repo)

- tools app = Docker Compose: nginx (Let's Encrypt TLS) → gunicorn/Django (2 workers) + selenium/standalone-chrome sidecar (drives Action Network UI) + SQLite on a Docker volume.
- Postgres is commented out — SQLite chosen "to use a much cheaper machine" (the box is intentionally tiny).
- No CI/CD deploy pipeline; deployment is manual \`docker compose up --build\` on the host. GitHub Actions only lints markdown.
- Code lives in the GitHub org Austin-DSA (github.com/Austin-DSA).`;

const INFRA_COST_SECTION = `## Cost (ESTIMATE — actual billing has NOT been seen)

| Line item | Estimate | Basis |
| --- | --- | --- |
| tools droplet (DigitalOcean) | ~$6–12/mo (1–2 GB) | Deliberately tiny per the SQLite choice |
| wiki droplet (DigitalOcean) | ~$12–24/mo (2–4 GB) | Outline needs Postgres + Redis |
| Self-hosted DO subtotal | ~$18–40/mo | Lower if wiki + tools share ONE droplet (unknown) |
| Cloudflare | likely $0 (free tier, unconfirmed) | |
| Squarespace | ~$16–23/mo | Separate budget line |
| Domain registration | ~$20/yr | Separate budget line |`;

const INFRA_CAPACITY_SECTION = `## Capacity: can Austin DSA run Onyx AI (RAG/enterprise search)?

| Mode | Needs | Verdict |
| --- | --- | --- |
| A — Onyx + EXTERNAL hosted LLM API | ~8 GB RAM / 4 vCPU / ~50 GB disk floor (16 GB recommended), no GPU | Feasible, but NOT on the current tiny droplets — needs a NEW ~8 GB droplet (≈$48–68/mo ESTIMATE + usage-based LLM API) |
| B — Onyx + fully LOCAL self-hosted LLM | GPU with 16–24 GB+ VRAM | Not feasible — no GPU exists in this infra |

Key constraint: all droplets are standard CPU-only. Onyx would roughly 2–3× the current DO bill and should get its own droplet (Vespa starves small boxes).`;

const INFRA_TOPIC_SECTIONS: Record<string, string> = {
  dns: INFRA_DNS_SECTION,
  hosting: INFRA_HOSTING_SECTION,
  cost: INFRA_COST_SECTION,
  capacity: INFRA_CAPACITY_SECTION,
};

export function createInfraReferenceTool(): DsaMcpTool {
  return defineDsaTool({
    toolName: 'infra_reference',
    description:
      'Austin DSA hosting-infrastructure reference: provider map (DNS-verified), architecture, cost estimates, and capacity analysis (e.g. "can the chapter run Onyx AI"). Static snapshot — no live lookups. Topics: dns, hosting, cost, capacity, or all.',
    inputSchema: {
      infraTopic: z.enum(['dns', 'hosting', 'cost', 'capacity', 'all']).default('all'),
    },
    execute: async ({ infraTopic }) => {
      const requestedSections =
        infraTopic === 'all'
          ? Object.values(INFRA_TOPIC_SECTIONS)
          : [INFRA_TOPIC_SECTIONS[infraTopic] ?? ''];
      return toTextResult([INFRA_SNAPSHOT_HEADER, ...requestedSections].join('\n\n'));
    },
  });
}
