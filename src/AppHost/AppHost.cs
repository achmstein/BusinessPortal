var builder = DistributedApplication.CreateBuilder(args);

// PostgreSQL with a persistent data volume — the app's only stateful resource.
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("businessportal-pg-data");

var db = postgres.AddDatabase("BusinessPortalDb");

var server = builder.AddProject<Projects.Web>("businessportal-server")
    .WithReference(db)
    .WaitFor(postgres)
    .WithHttpHealthCheck("/health");

// Run-mode only: the Vite dev server with HMR. WithReference injects the API
// endpoint the vite proxy reads; in publish mode the SPA is baked into wwwroot.
if (builder.ExecutionContext.IsRunMode)
{
    builder.AddViteApp("webfrontend", "../Web/ClientApp")
        .WithReference(server)
        .WaitFor(server);
}

builder.Build().Run();
