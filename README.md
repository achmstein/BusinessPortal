# Business Portal (.NET)

A .NET 10 port of the Business Portal client + admin app, built on the same
**.NET Aspire Clean Architecture** template as Asictron/NightTax: an ASP.NET Core
minimal-API host serving a React (Vite) SPA, EF Core on PostgreSQL, ASP.NET
Identity cookie auth, and Hangfire background jobs, orchestrated by .NET Aspire.

> **Status: work in progress.** This is a phased port of the original Next.js app
> (`davidorth/Business-Portal`). The solution scaffold, data model, auth, and a
> first set of features are being ported feature-by-feature. See the task list in
> the porting notes.

## Solution layout

| Project | Role |
| ------- | ---- |
| `src/BusinessPortal.Domain` | Entities, enums, pure domain services. No dependencies. |
| `src/BusinessPortal.Application` | Use-cases (MediatR commands/queries), interfaces (ports), DTOs. |
| `src/BusinessPortal.Infrastructure` | EF Core + Npgsql, Identity, Hangfire, external clients (ABN/ASIC/ATO/Renewtron). |
| `src/BusinessPortal.Web` | ASP.NET Core host: minimal-API endpoints + the React SPA in `ClientApp/`. |
| `src/BusinessPortal.ServiceDefaults` | Aspire shared defaults (OTel, health, resilience, discovery). |
| `src/BusinessPortal.AppHost` | Aspire orchestration (Postgres + web + Vite dev server). |
| `tests/BusinessPortal.Domain.UnitTests` | NUnit tests for pure domain logic. |

## Run locally

```bash
# Requires: .NET 10 SDK, Node 22, Docker (Aspire spins up Postgres in a container).
dotnet tool restore
dotnet run --project src/BusinessPortal.AppHost
```

The Aspire dashboard launches the web host + a Postgres container + the Vite dev
server (with HMR). The SPA proxies `/api` to the .NET host in development; on
publish it is built into `wwwroot` and served by the same container.

## Origin

Ported from the Next.js 15 app at `davidorth/Business-Portal`. Domain behaviour,
integrations (ABN Lookup, ASIC Connect, ATO myID, Renewtron), and the client/admin
feature set are being reimplemented in C# against this template.
