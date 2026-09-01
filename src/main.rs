use anyhow::Context;
use internal_event_ledger::{
    app, default_admin_token_path, default_database_url, load_or_create_admin_token,
    open_runtime_pool_with_retry, AppState, STARTUP_MAX_ATTEMPTS, STARTUP_RETRY_DELAY,
};
use std::{
    collections::HashSet,
    env,
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    process::ExitCode,
};
use tokio::net::TcpListener;
use tracing::{error, info};

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "internal_event_ledger=info,tower_http=info".into()),
        )
        .init();

    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(startup_error) => {
            error!(
                error = %startup_error,
                error_chain = ?startup_error,
                "internal-event-ledger stopped with an error"
            );
            // Keep a plain stderr line as a fallback for container log
            // collectors that do not retain structured tracing output.
            eprintln!("internal-event-ledger failed to start or serve: {startup_error:#}");
            ExitCode::FAILURE
        }
    }
}

async fn run() -> anyhow::Result<()> {
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| default_database_url());
    let static_dir = PathBuf::from(env::var("STATIC_DIR").unwrap_or_else(|_| "dist".into()));
    let port = match env::var("PORT") {
        Ok(value) => value.parse().with_context(|| {
            format!("PORT must be a number from 1 to 65535, received {value:?}")
        })?,
        Err(_) => 8080,
    };
    let admin_token_path = env::var("ADMIN_TOKEN_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| default_admin_token_path());
    info!(
        port,
        database_url,
        static_dir = %static_dir.display(),
        admin_token_file = %admin_token_path.display(),
        "ledger startup configuration loaded"
    );
    let (admin_token, admin_token_source) =
        load_or_create_admin_token(env::var("ADMIN_TOKEN").ok(), &admin_token_path).with_context(
            || {
                format!(
                    "could not load or create the administrator token at {}",
                    admin_token_path.display()
                )
            },
        )?;
    let trusted_proxy_ips: HashSet<IpAddr> = env::var("TRUSTED_PROXY_IPS")
        .ok()
        .into_iter()
        .flat_map(|value| {
            value
                .split(',')
                .map(str::trim)
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .filter_map(|value| value.parse().ok())
        .collect();
    let trusted_proxy_count = trusted_proxy_ips.len();
    let managed_ingress =
        env::var("CONTAINER_APP_NAME").is_ok() && env::var("CONTAINER_APP_REVISION").is_ok();

    // Reserve the configured port before SQLite startup so a rolling
    // replacement participates in the platform's startup lifecycle. Unlike
    // the failed candidate, this listener never serves a permanent 503: a
    // bounded lock retry either opens the durable database or exits for
    // the platform to restart.
    let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port)))
        .await
        .with_context(|| format!("could not bind HTTP listener on 0.0.0.0:{port}"))?;
    let pool = match open_runtime_pool_with_retry(
        &database_url,
        STARTUP_MAX_ATTEMPTS,
        STARTUP_RETRY_DELAY,
    )
    .await
    {
        Ok(pool) => pool,
        Err(startup_error) => {
            error!(
                error = %startup_error,
                startup_attempt_limit = STARTUP_MAX_ATTEMPTS,
                "ledger startup failed; exiting instead of serving an unready response"
            );
            return Err(startup_error).context(format!(
                "could not initialize SQLite storage at {database_url}"
            ));
        }
    };
    let state = AppState::new(pool, admin_token)
        .with_trusted_proxy_ips(trusted_proxy_ips)
        .with_managed_ingress(managed_ingress);
    info!(
        port,
        database_url,
        admin_token_source = %admin_token_source,
        admin_token_file = %admin_token_path.display(),
        trusted_proxy_count,
        managed_ingress,
        sqlite_connections = 1,
        startup_attempt_limit = STARTUP_MAX_ATTEMPTS,
        "ledger ready"
    );
    axum::serve(
        listener,
        app(state, static_dir).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("HTTP server stopped unexpectedly")?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async { tokio::signal::ctrl_c().await.expect("ctrl-c handler") };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("signal handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
}
