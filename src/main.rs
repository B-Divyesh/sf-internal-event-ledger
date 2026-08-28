use anyhow::Context;
use internal_event_ledger::{app, create_pool, AppState};
use std::{env, net::SocketAddr, path::PathBuf};
use tokio::net::TcpListener;
use tracing::info;

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
    let admin_token = env::var("ADMIN_TOKEN")
        .ok()
        .filter(|token| !token.trim().is_empty())
        .context("ADMIN_TOKEN is required; generate a high-entropy administrator token before starting the ledger")?;
    let billing_api_base = env::var("BILLING_API_BASE")
        .unwrap_or_else(|_| "https://api.sociobot.in/api/v1/products/internal-event-ledger".into());
    let pool = create_pool(&database_url).await?;
    let state = AppState::new(pool, admin_token, billing_api_base);
    let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).await?;
    info!(port, "ledger ready");
    axum::serve(listener, app(state, static_dir))
        .with_graceful_shutdown(shutdown_signal())
        .await?;
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
