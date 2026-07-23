using Aspire.Hosting.Docker.Resources.ComposeNodes;
using Aspire.Hosting.Docker.Resources.ServiceNodes;

var builder = DistributedApplication.CreateBuilder(args);

// Public hostname the deployed site answers on (Caddy vhost). Override via AppHost
// configuration/user-secrets: "PublicHost". Trimmed so a stray newline can't corrupt
// the Caddy label and silently break routing.
var publicHost = (builder.Configuration["PublicHost"] ?? "myportal.idealbusiness.au").Trim();

builder.AddDockerComposeEnvironment("businessportal-compose")
    .WithDashboard(false)
    .ConfigureComposeFile(compose =>
    {
        // The host's caddy-docker-proxy lives on an external `caddy` network.
        compose.AddNetwork(new Network { Name = "caddy", External = true });

        // Persists ASP.NET Data Protection keys so auth cookies survive redeploys.
        compose.AddVolume(new Volume { Name = "businessportal-keys", Driver = "local" });

        // Persists UI-entered integration settings (settings.overrides.json)
        // across redeploys. The server mounts this at /data (see below).
        compose.AddVolume(new Volume { Name = "businessportal-data", Driver = "local" });
    });

var pgPassword = builder.AddParameter("postgres-password", secret: true);

var postgres = builder.AddPostgres("postgres", password: pgPassword)
    .WithImageTag("17.6")
    .WithDataVolume("businessportal-pg-data")
    .WithLifetime(ContainerLifetime.Persistent)
    .PublishAsDockerComposeService((_, service) => service.Restart = "unless-stopped");

var db = postgres.AddDatabase("BusinessPortalDb");

// Single container: the .NET server hosts the API AND the built React SPA (wwwroot).
// The host's caddy-docker-proxy routes the public host straight to it (port 8080).
var server = builder.AddProject<Projects.Web>("businessportal-server")
    .WithReference(db)
    .WaitFor(postgres)
    .WithEnvironment("DataProtection__KeysDirectory", "/keys")
    // 2Captcha / Ontraport / email credentials are entered from the admin Settings
    // UI and written to the overrides file on the persistent /data volume (below) —
    // no longer injected as build/deploy secrets.
    .WithEnvironment("Storage__OverridesPath", "/data/settings.overrides.json")
    .WithHttpHealthCheck("/health")
    .PublishAsDockerFile()
    .PublishAsDockerComposeService((_, service) =>
    {
        service.Restart = "unless-stopped";
        service.Ports.Clear();
        service.Networks.Add("caddy");
        // Run as root so the app can write Data Protection keys + the settings
        // overrides file to the mounted volumes.
        service.User = "root";
        service.AddVolume(new Volume
        {
            Name = "businessportal-keys",
            Type = "volume",
            Source = "businessportal-keys",
            Target = "/keys",
        });
        service.AddVolume(new Volume
        {
            Name = "businessportal-data",
            Type = "volume",
            Source = "businessportal-data",
            Target = "/data",
        });
        service.Labels["caddy"] = publicHost;
        service.Labels["caddy.reverse_proxy"] = "{{upstreams 8080}}";
    });

if (builder.ExecutionContext.IsRunMode)
{
    // Local dev: Vite dev server with HMR; WithReference injects the /api proxy target.
    builder.AddViteApp("webfrontend", "../Web/ClientApp")
        .WithReference(server)
        .WaitFor(server);
}

builder.Build().Run();
