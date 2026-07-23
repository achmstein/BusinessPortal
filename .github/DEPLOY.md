# Deploy

Workflow-driven deploy modelled on Asictron/NightTax: **build the server image in CI
(API + baked-in React SPA), push to GHCR, generate a docker-compose via `aspire
publish`, then SSH to the box and roll the stack** behind `caddy-docker-proxy`.

|                    | Production                                   |
| ------------------ | -------------------------------------------- |
| Domain             | `myportal.idealbusiness.au`                  |
| Workflow           | `.github/workflows/deploy.yml` (manual run)  |
| Orchestration      | `aspire publish` → `docker-compose.yaml`     |
| Image              | `ghcr.io/<owner>/business-portal-server`     |
| Routing / TLS      | host `caddy-docker-proxy` (external `caddy` network) |
| Data               | Postgres 17.6 in `businessportal-pg-data`; Data Protection keys in `businessportal-keys`; UI-entered settings in `businessportal-data` |

## What the compose contains

- **postgres** — `postgres:17.6`, persistent data volume, password from `POSTGRES_PASSWORD`.
- **businessportal-server** — the .NET host (API + SPA), `ConnectionStrings__BusinessPortalDb`
  wired to postgres, `DataProtection__KeysDirectory=/keys` (keys volume so auth cookies
  survive redeploys), `Storage__OverridesPath=/data/settings.overrides.json` (data volume
  holding admin-entered integration settings), on the external `caddy` network with
  labels `caddy=<PublicHost>` + `caddy.reverse_proxy={{upstreams 8080}}`.

## Integration credentials (no longer deploy secrets)

2Captcha, Ontraport webhook secrets, email (Resend), and the ABN Lookup token are
entered in the app at **Admin → Settings** and persisted to
`settings.overrides.json` on the `businessportal-data` volume — they survive
redeploys, take effect immediately (no restart), and are not passed through CI.

## Required GitHub configuration

### Repo variables (Settings → Secrets and variables → Actions → Variables)

| Variable                     | Example                          |
| ---------------------------- | -------------------------------- |
| `SERVER_HOST`                | `<lightsail-static-ip>`          |
| `SERVER_USER`                | `ubuntu`                         |
| `BUSINESSPORTAL_REMOTE_DIR`  | `/home/ubuntu/business-portal`   |
| `BUSINESSPORTAL_PUBLIC_HOST` | `myportal.idealbusiness.au`      |

### Secrets

| Secret                     | Used for                                        |
| -------------------------- | ----------------------------------------------- |
| `DEPLOY_SSH_KEY`           | Private half of the deploy keypair              |
| `POSTGRES_PASSWORD`        | Postgres password (stable across deploys)       |

Formerly-required `ONTRAPORT_WEBHOOK_SECRET` / `ONTRAPORT_RENEWAL_SECRET` are gone —
enter them in Admin → Settings instead.

> `GITHUB_TOKEN` is built-in (GHCR push + docker login). No setup needed.

## One-time server setup

1. Ubuntu 24.04 host, static IP, ports 80/443 open.
2. Docker (the workflow installs it if missing).
3. `caddy-docker-proxy` running on an external `caddy` network (the workflow creates the
   network if missing; run the proxy container once — it issues Let's Encrypt certs
   automatically per the compose labels).
4. Add the deploy key's public half to `~/.ssh/authorized_keys`.
5. DNS A record `myportal.idealbusiness.au` → the static IP.

Then: **Actions → Build and Deploy → Run workflow**.

## Local run

```bash
dotnet tool restore
dotnet run --project src/AppHost        # Aspire: Postgres + web + Vite dev server
```
