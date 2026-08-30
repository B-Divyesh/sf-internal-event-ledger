use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderValue, Request, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use internal_event_ledger::{
    app, create_pool, create_rate_limit_pool, load_or_create_admin_token, AppState,
};
use std::{
    collections::HashSet,
    env,
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    sync::Arc,
};
use tokio::{
    net::TcpListener,
    sync::RwLock,
    time::{sleep, Duration},
};
use tower::ServiceExt;
use tracing::{error, info, warn};

#[derive(Clone, Default)]
struct Runtime {
    app: Arc<RwLock<Option<Router>>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "internal_event_ledger=info,tower_http=info".into()),
        )
        .init();

    let database_url =
        env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://ledger.db?mode=rwc".into());
    let static_dir = PathBuf::from(env::var("STATIC_DIR").unwrap_or_else(|_| "dist".into()));
    let port = env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8080);
    // Bind before opening SQLite. Container Apps uses a TCP startup probe by
    // default, so this lets a rolling replacement become runnable and allows
    // the prior single-writer revision to release the durable /data file.
    let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).await?;
    let admin_token_path = PathBuf::from(
        env::var("ADMIN_TOKEN_FILE")
            .unwrap_or_else(|_| ".internal-event-ledger-admin-token".into()),
    );
    let (admin_token, admin_token_source) =
        load_or_create_admin_token(env::var("ADMIN_TOKEN").ok(), &admin_token_path)?;
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
    let runtime = Runtime::default();
    let initializing_runtime = runtime.clone();
    tokio::spawn(async move {
        match open_runtime_pools(&database_url).await {
            Ok((pool, rate_limit_pool)) => {
                let state = AppState::new(pool, admin_token)
                    .with_rate_limit_pool(rate_limit_pool)
                    .with_trusted_proxy_ips(trusted_proxy_ips)
                    .with_managed_ingress(managed_ingress);
                *initializing_runtime.app.write().await = Some(app(state, static_dir));
                info!(
                    admin_token_source = %admin_token_source,
                    admin_token_file = %admin_token_path.display(),
                    trusted_proxy_count,
                    managed_ingress,
                    "ledger ready"
                );
            }
            Err(initialization_error) => {
                error!(error = %initialization_error, "ledger could not open its SQLite state");
            }
        }
    });
    info!(
        port,
        trusted_proxy_count, managed_ingress, "ledger startup listener ready"
    );
    axum::serve(
        listener,
        starting_router(runtime).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

fn starting_router(runtime: Runtime) -> Router {
    Router::new().fallback(any(dispatch)).with_state(runtime)
}

async fn dispatch(State(runtime): State<Runtime>, request: Request<Body>) -> Response {
    let active_app = runtime.app.read().await.clone();
    if let Some(active_app) = active_app {
        return active_app
            .oneshot(request)
            .await
            .unwrap_or_else(|never| match never {});
    }
    let mut response = (
        StatusCode::SERVICE_UNAVAILABLE,
        "Ledger is starting its local storage. Try again shortly.",
    )
        .into_response();
    response
        .headers_mut()
        .insert(header::RETRY_AFTER, HeaderValue::from_static("2"));
    response
}

async fn open_runtime_pools(
    database_url: &str,
) -> anyhow::Result<(sqlx::SqlitePool, sqlx::SqlitePool)> {
    let mut attempt = 0u64;
    loop {
        attempt += 1;
        let error = match create_pool(database_url)
            .await
            .map_err(|error| anyhow::anyhow!("ledger SQLite: {error}"))
        {
            Ok(pool) => match create_rate_limit_pool(database_url).await {
                Ok(rate_limit_pool) => return Ok((pool, rate_limit_pool)),
                Err(error) => {
                    drop(pool);
                    anyhow::anyhow!("rate-limit SQLite: {error}")
                }
            },
            Err(error) => error,
        };
        if !is_database_locked(&error) {
            return Err(error);
        }
        warn!(attempt, "SQLite is busy during rolling startup; retrying");
        sleep(Duration::from_secs(2)).await;
    }
}

fn is_database_locked(error: &anyhow::Error) -> bool {
    error
        .chain()
        .any(|cause| cause.to_string().contains("database is locked"))
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
