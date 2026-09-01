use axum::{
    body::{Body, Bytes},
    extract::{ConnectInfo, DefaultBodyLimit, Extension, Path, Query, State},
    http::{header, HeaderMap, HeaderValue, Request, StatusCode},
    middleware::{self, Next},
    response::{Html, IntoResponse, Response},
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow},
    FromRow, Row, SqlitePool,
};
use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::{ErrorKind, Write},
    net::IpAddr,
    path::{Path as FilePath, PathBuf},
    str::FromStr,
    sync::Arc,
    time::Duration as StdDuration,
};
use subtle::ConstantTimeEq;
use tower_http::{
    catch_panic::CatchPanicLayer,
    limit::RequestBodyLimitLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing::warn;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

/// A new directory is deliberately used for the repaired ledger.  It keeps
/// this revision away from a file which an earlier revision may still have
/// locked on the durable share.  The application never deletes or renames
/// that older file.
pub const STORAGE_SUBDIRECTORY: &str = "internal-event-ledger-r8";
pub const DATABASE_FILE_NAME: &str = "ledger.db";
pub const STARTUP_MAX_ATTEMPTS: usize = 3;
pub const STARTUP_RETRY_DELAY: StdDuration = StdDuration::from_secs(1);

pub fn default_storage_directory() -> PathBuf {
    let durable_mount = FilePath::new("/data");
    if durable_mount.is_dir() {
        return durable_mount.join(STORAGE_SUBDIRECTORY);
    }

    // Native development does not normally have the deployment's mounted
    // share.  The image always has /data, so deployed state remains strictly
    // under /data while a PORT-only local run still works without setup.
    PathBuf::from(".internal-event-ledger-data")
}

pub fn default_database_url() -> String {
    sqlite_url(&default_storage_directory().join(DATABASE_FILE_NAME))
}

pub fn default_admin_token_path() -> PathBuf {
    default_storage_directory().join("admin-token")
}

pub fn sqlite_url(path: &FilePath) -> String {
    format!("sqlite://{}?mode=rwc", path.display())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdminTokenSource {
    Supplied,
    Persisted,
    Generated,
}

impl std::fmt::Display for AdminTokenSource {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Supplied => "supplied",
            Self::Persisted => "persisted",
            Self::Generated => "generated",
        })
    }
}

pub fn load_or_create_admin_token(
    supplied: Option<String>,
    token_path: &FilePath,
) -> anyhow::Result<(String, AdminTokenSource)> {
    if let Some(token) = supplied.filter(|token| !token.trim().is_empty()) {
        return Ok((token, AdminTokenSource::Supplied));
    }

    match fs::read_to_string(token_path) {
        Ok(token) if !token.trim().is_empty() => {
            return Ok((token.trim().to_owned(), AdminTokenSource::Persisted));
        }
        Ok(_) => anyhow::bail!(
            "administrator token file is empty: {}",
            token_path.display()
        ),
        Err(error) if error.kind() != ErrorKind::NotFound => return Err(error.into()),
        Err(_) => {}
    }

    if let Some(parent) = token_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)?;
    }
    let mut random = [0u8; 32];
    rand::rng().fill_bytes(&mut random);
    let token = hex::encode(random);
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    match options.open(token_path) {
        Ok(mut file) => {
            writeln!(file, "{token}")?;
            file.sync_all()?;
            Ok((token, AdminTokenSource::Generated))
        }
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            let token = fs::read_to_string(token_path)?;
            if token.trim().is_empty() {
                anyhow::bail!(
                    "administrator token file is empty: {}",
                    token_path.display()
                );
            }
            Ok((token.trim().to_owned(), AdminTokenSource::Persisted))
        }
        Err(error) => Err(error.into()),
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    admin_token: Arc<str>,
    trusted_proxy_ips: Arc<HashSet<IpAddr>>,
    trust_managed_ingress: bool,
}

impl AppState {
    pub fn new(pool: SqlitePool, admin_token: String) -> Self {
        Self {
            pool,
            admin_token: Arc::from(admin_token),
            trusted_proxy_ips: Arc::new(HashSet::new()),
            trust_managed_ingress: false,
        }
    }

    pub fn with_trusted_proxy_ips(mut self, trusted_proxy_ips: HashSet<IpAddr>) -> Self {
        self.trusted_proxy_ips = Arc::new(trusted_proxy_ips);
        self
    }

    pub fn with_managed_ingress(mut self, enabled: bool) -> Self {
        self.trust_managed_ingress = enabled;
        self
    }
}

pub async fn create_pool(url: &str) -> anyhow::Result<SqlitePool> {
    let pool = open_pool(url).await?;

    // A rolling deployment starts the new revision alongside the old one. Do
    // not issue `CREATE … IF NOT EXISTS` against a ledger that is already
    // initialized: SQLite treats that as a write and it can contend with the
    // serving revision on the durable /data volume. New databases still get
    // the complete schema before the application accepts requests.
    let initialized = async {
        if !table_exists(&pool, "sources").await? {
            sqlx::raw_sql(include_str!("../migrations/0001_init.sql"))
                .execute(&pool)
                .await?;
            sqlx::raw_sql(include_str!(
                "../migrations/0002_shared_ephemeral_state.sql"
            ))
            .execute(&pool)
            .await?;
        }
        Ok::<(), anyhow::Error>(())
    }
    .await;
    if let Err(error) = initialized {
        pool.close().await;
        return Err(error);
    }
    Ok(pool)
}

async fn open_pool(url: &str) -> anyhow::Result<SqlitePool> {
    ensure_database_parent(url)?;
    let options = SqliteConnectOptions::from_str(url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(StdDuration::from_secs(1))
        // Azure Files is a mounted share, not a local disk.  Keep SQLite in
        // the conservative rollback-journal mode requested for this service.
        .journal_mode(SqliteJournalMode::Delete);
    let pool = SqlitePoolOptions::new()
        // The mounted volume has one replica and this pool has exactly one
        // connection.  All ledger, demo, and rate-limit writes serialize on
        // that connection instead of creating competing SQLite writers.
        .max_connections(1)
        .after_connect(|connection, _| {
            Box::pin(async move {
                sqlx::query("PRAGMA busy_timeout = 1000")
                    .execute(connection)
                    .await?;
                Ok(())
            })
        })
        .connect_with(options)
        .await?;
    Ok(pool)
}

fn ensure_database_parent(url: &str) -> anyhow::Result<()> {
    let Some(database_path) = sqlite_file_path(url) else {
        return Ok(());
    };
    if let Some(parent) = database_path
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

async fn table_exists(pool: &SqlitePool, table: &str) -> anyhow::Result<bool> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?)",
    )
    .bind(table)
    .fetch_one(pool)
    .await?
        != 0)
}

fn sqlite_file_path(url: &str) -> Option<PathBuf> {
    let path = url
        .split_once('?')
        .map(|(path, _)| path)
        .unwrap_or(url)
        .strip_prefix("sqlite://")?;
    if path == ":memory:" || path.is_empty() {
        return None;
    }
    Some(FilePath::new(path).to_path_buf())
}

pub async fn open_runtime_pool_with_retry(
    database_url: &str,
    max_attempts: usize,
    retry_delay: StdDuration,
) -> anyhow::Result<SqlitePool> {
    let max_attempts = max_attempts.max(1);
    for attempt in 1..=max_attempts {
        match create_pool(database_url).await {
            Ok(pool) => return Ok(pool),
            Err(error) if is_database_locked(&error) && attempt < max_attempts => {
                warn!(
                    attempt,
                    max_attempts,
                    error = %error,
                    "SQLite is busy during startup; retrying"
                );
                tokio::time::sleep(retry_delay).await;
            }
            Err(error) if is_database_locked(&error) => {
                anyhow::bail!(
                    "SQLite remained locked after {max_attempts} startup attempts: {error}"
                );
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!("the startup retry loop always returns")
}

pub fn is_database_locked(error: &anyhow::Error) -> bool {
    error.chain().any(|cause| {
        let text = cause.to_string().to_ascii_lowercase();
        text.contains("database is locked")
            || text.contains("database is busy")
            || text.contains("sqlite_busy")
            || text.contains("sqlite code 5")
    })
}

pub fn app(state: AppState, static_dir: PathBuf) -> Router {
    let index = static_dir.join("index.html");
    let ingest_routes = Router::new()
        .route("/ingest/{alias}", post(ingest))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            limit_ingest_requests,
        ));
    let protected_api = Router::new()
        .route("/sources", get(list_sources).post(create_source))
        .route("/sources/{id}", delete(delete_source))
        .route("/events", get(list_events).patch(bulk_update_events))
        .route("/events/{id}", patch(update_event))
        .route("/digest", get(digest))
        .route("/export", get(export_events))
        .route("/settings", get(get_settings).put(update_settings))
        .route("/maintenance/retention", post(run_retention))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_admin));
    let demo_api = Router::new()
        .route("/demo", post(create_demo))
        .route("/demo/{id}", get(get_demo).delete(delete_demo));
    let api = Router::new()
        .merge(protected_api)
        .merge(demo_api)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            limit_api_requests,
        ));
    Router::new()
        .route("/health", get(health))
        .merge(ingest_routes)
        .nest("/api", api)
        .route_service("/", ServeFile::new(index.clone()))
        .route_service("/demo", ServeFile::new(index.clone()))
        .route_service("/privacy", ServeFile::new(index.clone()))
        .route_service("/terms", ServeFile::new(index.clone()))
        .route_service("/robots.txt", ServeFile::new(static_dir.join("robots.txt")))
        .route_service(
            "/sitemap.xml",
            ServeFile::new(static_dir.join("sitemap.xml")),
        )
        .route_service(
            "/manifest.webmanifest",
            ServeFile::new(static_dir.join("manifest.webmanifest")),
        )
        .route_service("/sw.js", ServeFile::new(static_dir.join("sw.js")))
        .route_service(
            "/favicon.svg",
            ServeFile::new(static_dir.join("favicon.svg")),
        )
        .route_service("/404.css", ServeFile::new(static_dir.join("404.css")))
        .route_service(
            "/apple-touch-icon.png",
            ServeFile::new(static_dir.join("apple-touch-icon.png")),
        )
        .route_service(
            "/social-card.webp",
            ServeFile::new(static_dir.join("social-card.webp")),
        )
        .nest_service("/assets", ServeDir::new(static_dir.join("assets")))
        .route_service("/404.html", ServeFile::new(static_dir.join("404.html")))
        .fallback(not_found)
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(256 * 1024))
        .layer(middleware::from_fn(security_headers))
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn not_found() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Html(include_str!("../frontend/public/404.html")),
    )
}

async fn security_headers(req: Request<Body>, next: Next) -> Response {
    let path = req.uri().path().to_owned();
    let mut response = next.run(req).await;
    let is_html = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("text/html"));
    let h = response.headers_mut();
    h.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    h.insert("x-frame-options", HeaderValue::from_static("DENY"));
    h.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    // This host is HTTPS-only. Do not include subdomains: deployments can use
    // independent hostnames that are outside this product's security policy.
    h.insert(
        "strict-transport-security",
        HeaderValue::from_static("max-age=31536000"),
    );
    h.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    h.insert("content-security-policy", HeaderValue::from_static("default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"));
    let cache_control = if path.starts_with("/api/")
        || path.starts_with("/ingest/")
        || path == "/health"
    {
        "no-store"
    } else if path == "/sw.js" || path == "/" || path == "/privacy" || path == "/terms" || is_html {
        "no-cache"
    } else if is_hashed_asset(&path) {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=86400"
    };
    h.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );
    response
}

fn is_hashed_asset(path: &str) -> bool {
    let Some(file_name) = path.rsplit('/').next() else {
        return false;
    };
    let Some(stem) = file_name.rsplit_once('.').map(|(stem, _)| stem) else {
        return false;
    };
    let Some((_, hash)) = stem.rsplit_once('-') else {
        return false;
    };
    hash.len() >= 8
        && hash
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

async fn require_admin(
    State(s): State<AppState>,
    headers: HeaderMap,
    request: Request<Body>,
    next: Next,
) -> Response {
    let provided = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    if provided
        .as_bytes()
        .ct_eq(s.admin_token.as_bytes())
        .unwrap_u8()
        != 1
    {
        return ApiError(
            StatusCode::UNAUTHORIZED,
            "Administrator authentication is required for ledger data and settings.".into(),
        )
        .into_response();
    }
    next.run(request).await
}

async fn limit_api_requests(
    State(state): State<AppState>,
    peer: Option<Extension<ConnectInfo<std::net::SocketAddr>>>,
    headers: HeaderMap,
    request: Request<Body>,
    next: Next,
) -> Response {
    let address = client_ip(&state, peer.as_ref().map(|Extension(peer)| peer), &headers);
    let allowed = match take_shared_request_token(&state.pool, "api", address, 60.0, 20.0).await {
        Ok(allowed) => allowed,
        Err(error) => return error.into_response(),
    };
    if !allowed {
        return ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "This client is sending API requests too quickly. Try again shortly.".into(),
        )
        .into_response();
    }
    next.run(request).await
}

async fn limit_ingest_requests(
    State(state): State<AppState>,
    peer: Option<Extension<ConnectInfo<std::net::SocketAddr>>>,
    headers: HeaderMap,
    request: Request<Body>,
    next: Next,
) -> Response {
    let address = client_ip(&state, peer.as_ref().map(|Extension(peer)| peer), &headers);
    let allowed = match take_shared_request_token(&state.pool, "ingest", address, 240.0, 40.0).await
    {
        Ok(allowed) => allowed,
        Err(error) => return error.into_response(),
    };
    if !allowed {
        return ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "This client is sending receiver requests too quickly. Try again shortly.".into(),
        )
        .into_response();
    }
    next.run(request).await
}

async fn take_shared_request_token(
    pool: &SqlitePool,
    scope: &str,
    address: Option<IpAddr>,
    capacity: f64,
    refill_per_second: f64,
) -> Result<bool, ApiError> {
    let key = format!(
        "{scope}:{}",
        address
            .map(|ip| ip.to_string())
            .unwrap_or_else(|| "direct".into())
    );
    let now_ms = Utc::now().timestamp_millis();
    let accepted = sqlx::query_scalar::<_, String>(
        r#"INSERT INTO request_rate_limits(bucket_key,tokens,updated_at_ms)
           VALUES(?, ? - 1.0, ?)
           ON CONFLICT(bucket_key) DO UPDATE SET
             tokens = MIN(?, request_rate_limits.tokens +
               MAX(0.0, (? - request_rate_limits.updated_at_ms) / 1000.0) * ?) - 1.0,
             updated_at_ms = ?
           WHERE MIN(?, request_rate_limits.tokens +
             MAX(0.0, (? - request_rate_limits.updated_at_ms) / 1000.0) * ?) >= 1.0
           RETURNING bucket_key"#,
    )
    .bind(&key)
    .bind(capacity)
    .bind(now_ms)
    .bind(capacity)
    .bind(now_ms)
    .bind(refill_per_second)
    .bind(now_ms)
    .bind(capacity)
    .bind(now_ms)
    .bind(refill_per_second)
    .fetch_optional(pool)
    .await?;

    // Bound storage used by spoof-resistant client keys. Cleanup is deliberately
    // opportunistic so it does not add a write to every request.
    if now_ms.rem_euclid(257) == 0 {
        let _ = sqlx::query("DELETE FROM request_rate_limits WHERE updated_at_ms < ?")
            .bind(now_ms - 86_400_000)
            .execute(pool)
            .await;
    }
    Ok(accepted.is_some())
}

#[derive(Debug)]
struct ApiError(StatusCode, String);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.0;
        let mut response = (status, Json(json!({"error": self.1}))).into_response();
        if status == StatusCode::TOO_MANY_REQUESTS {
            response
                .headers_mut()
                .insert(header::RETRY_AFTER, HeaderValue::from_static("1"));
        }
        response
    }
}
impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!(%error, "database error");
        ApiError(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The ledger database could not complete that request.".into(),
        )
    }
}

async fn create_demo(
    State(state): State<AppState>,
    peer: Option<Extension<ConnectInfo<std::net::SocketAddr>>>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let address = client_ip(&state, peer.as_ref().map(|Extension(peer)| peer), &headers);
    if !take_shared_request_token(&state.pool, "demo-create", address, 10.0, 1.0 / 60.0).await? {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "This client created too many demos. Try again shortly.".into(),
        ));
    }
    let id = Uuid::new_v4().to_string();
    let payload = demo_payload(&id);
    let now = Utc::now().timestamp();
    sqlx::query("DELETE FROM demo_workspaces WHERE created_at_unix <= ?")
        .bind(now - 86_400)
        .execute(&state.pool)
        .await?;
    sqlx::query(
        "INSERT INTO demo_workspaces(workspace_id,payload_json,created_at_unix) VALUES(?,?,?)",
    )
    .bind(&id)
    .bind(payload.to_string())
    .bind(now)
    .execute(&state.pool)
    .await?;
    Ok(Json(payload))
}

async fn get_demo(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let now = Utc::now().timestamp();
    sqlx::query("DELETE FROM demo_workspaces WHERE created_at_unix <= ?")
        .bind(now - 86_400)
        .execute(&state.pool)
        .await?;
    let payload = sqlx::query_scalar::<_, String>(
        "SELECT payload_json FROM demo_workspaces WHERE workspace_id=?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| {
        ApiError(
            StatusCode::NOT_FOUND,
            "This demo expired. Reset the demo to load a fresh sample.".into(),
        )
    })?;
    let payload = serde_json::from_str(&payload).map_err(|error| {
        tracing::error!(%error, "stored demo workspace is invalid");
        ApiError(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The sample workspace could not be loaded. Reset the demo to try again.".into(),
        )
    })?;
    Ok(Json(payload))
}

async fn delete_demo(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    sqlx::query("DELETE FROM demo_workspaces WHERE workspace_id=?")
        .bind(id)
        .execute(&state.pool)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

fn demo_payload(workspace_id: &str) -> Value {
    let now = Utc::now();
    let checkout = format!("demo-{workspace_id}-checkout");
    let deploys = format!("demo-{workspace_id}-deploys");
    let imports = format!("demo-{workspace_id}-imports");
    json!({
        "workspace_id": workspace_id,
        "expires_in_seconds": 86_400,
        "digest_hour": "09:00",
        "sources": [
            {"id":checkout,"name":"Checkout API","alias":"checkout-api","redact_headers":"[\"x-customer-email\"]","redact_paths":"[\"customer.email\",\"payment.card\"]","retention_days":30,"created_at":(now-Duration::days(18)).to_rfc3339(),"event_count":2,"unread_count":1},
            {"id":deploys,"name":"Deploy pipeline","alias":"deploys","redact_headers":"[]","redact_paths":"[\"actor.email\"]","retention_days":30,"created_at":(now-Duration::days(12)).to_rfc3339(),"event_count":1,"unread_count":0},
            {"id":imports,"name":"Customer imports","alias":"customer-imports","redact_headers":"[]","redact_paths":"[\"customer.email\"]","retention_days":14,"created_at":(now-Duration::days(7)).to_rfc3339(),"event_count":2,"unread_count":2}
        ],
        "events": [
            {"id":format!("demo-{workspace_id}-refund"),"source_id":checkout,"source_name":"Checkout API","source_alias":"checkout-api","fingerprint":"6c2e197ea64342c1","event_type":"refund.requested","summary":"Refund review requested for annual plan","payload_json":"{\"amount\":12900,\"currency\":\"USD\",\"customer\":{\"email\":\"[REDACTED]\"},\"reason\":\"duplicate purchase\"}","headers_json":"{\"content-type\":\"application/json\",\"x-customer-email\":\"[REDACTED]\"}","status":"unread","occurrence_count":3,"received_at":(now-Duration::hours(4)).to_rfc3339(),"last_seen_at":(now-Duration::minutes(18)).to_rfc3339()},
            {"id":format!("demo-{workspace_id}-latency"),"source_id":checkout,"source_name":"Checkout API","source_alias":"checkout-api","fingerprint":"178e34b390b24908","event_type":"checkout.latency","summary":"Checkout latency crossed 900 ms","payload_json":"{\"p95_ms\":947,\"region\":\"west-europe\"}","headers_json":"{\"content-type\":\"application/json\"}","status":"acknowledged","occurrence_count":5,"received_at":(now-Duration::hours(9)).to_rfc3339(),"last_seen_at":(now-Duration::hours(2)).to_rfc3339()},
            {"id":format!("demo-{workspace_id}-deploy"),"source_id":deploys,"source_name":"Deploy pipeline","source_alias":"deploys","fingerprint":"52aaab1346814d20","event_type":"deploy.completed","summary":"Production deploy 2026.08.30 completed","payload_json":"{\"version\":\"2026.08.30\",\"duration_seconds\":184,\"actor\":{\"email\":\"[REDACTED]\"}}","headers_json":"{\"content-type\":\"application/json\"}","status":"acknowledged","occurrence_count":1,"received_at":(now-Duration::hours(3)).to_rfc3339(),"last_seen_at":(now-Duration::hours(3)).to_rfc3339()},
            {"id":format!("demo-{workspace_id}-import"),"source_id":imports,"source_name":"Customer imports","source_alias":"customer-imports","fingerprint":"3cb36f5d7b4a41d8","event_type":"import.delayed","summary":"Catalogue import is waiting for two files","payload_json":"{\"job\":\"catalogue-4182\",\"missing\":[\"prices.csv\",\"variants.csv\"],\"customer\":{\"email\":\"[REDACTED]\"}}","headers_json":"{\"content-type\":\"application/json\"}","status":"unread","occurrence_count":2,"received_at":(now-Duration::minutes(54)).to_rfc3339(),"last_seen_at":(now-Duration::minutes(31)).to_rfc3339()},
            {"id":format!("demo-{workspace_id}-mapping"),"source_id":imports,"source_name":"Customer imports","source_alias":"customer-imports","fingerprint":"938be27d69944552","event_type":"import.mapping_warning","summary":"Three product rows need category mapping","payload_json":"{\"job\":\"catalogue-4179\",\"row_count\":3,\"categories\":[\"seasonal\",\"gift-card\"]}","headers_json":"{\"content-type\":\"application/json\"}","status":"unread","occurrence_count":1,"received_at":(now-Duration::hours(6)).to_rfc3339(),"last_seen_at":(now-Duration::hours(6)).to_rfc3339()}
        ]
    })
}

#[derive(Serialize)]
struct SourceView {
    id: String,
    name: String,
    alias: String,
    redact_headers: String,
    redact_paths: String,
    retention_days: i64,
    created_at: String,
    event_count: i64,
    unread_count: i64,
}

impl<'r> FromRow<'r, SqliteRow> for SourceView {
    fn from_row(row: &'r SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            alias: row.try_get("alias")?,
            redact_headers: row.try_get("redact_headers")?,
            redact_paths: row.try_get("redact_paths")?,
            retention_days: row.try_get("retention_days")?,
            created_at: row.try_get("created_at")?,
            event_count: row.try_get("event_count")?,
            unread_count: row.try_get("unread_count")?,
        })
    }
}

async fn list_sources(State(s): State<AppState>) -> Result<Json<Value>, ApiError> {
    let rows = sqlx::query_as::<_, SourceView>(r#"
        SELECT s.id,s.name,s.alias,s.redact_headers,s.redact_paths,s.retention_days,s.created_at,
          COUNT(e.id) event_count, COALESCE(SUM(CASE WHEN e.status='unread' THEN 1 ELSE 0 END),0) unread_count
        FROM sources s LEFT JOIN events e ON e.source_id=s.id GROUP BY s.id ORDER BY s.created_at"#)
        .fetch_all(&s.pool).await?;
    Ok(Json(json!({"sources": rows})))
}

#[derive(Deserialize)]
struct NewSource {
    name: String,
    alias: String,
    signing_secret: Option<String>,
    #[serde(default)]
    redact_headers: Vec<String>,
    #[serde(default)]
    redact_paths: Vec<String>,
    retention_days: Option<i64>,
}

async fn create_source(
    State(s): State<AppState>,
    Json(input): Json<NewSource>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let alias = input.alias.trim().to_ascii_lowercase();
    if input.name.trim().is_empty() || input.name.len() > 80 {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Name must be between 1 and 80 characters.".into(),
        ));
    }
    if alias.len() < 2
        || alias.len() > 48
        || !alias
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Alias must be 2–48 lowercase letters, numbers, or hyphens.".into(),
        ));
    }
    if input.redact_headers.len() > 32 || input.redact_paths.len() > 32 {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Use at most 32 redaction rules of each type.".into(),
        ));
    }
    let retention = input.retention_days.unwrap_or(30);
    if !(1..=3650).contains(&retention) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Retention must be between 1 and 3650 days.".into(),
        ));
    }
    let mut raw = [0u8; 24];
    rand::rng().fill_bytes(&mut raw);
    let token = hex::encode(raw);
    let token_hash = sha256_hex(token.as_bytes());
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let result = match sqlx::query(
        "INSERT INTO sources(id,name,alias,token_hash,signing_secret,redact_headers,redact_paths,retention_days,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    )
        .bind(&id)
        .bind(input.name.trim())
        .bind(&alias)
        .bind(token_hash)
        .bind(input.signing_secret.filter(|v| !v.is_empty()))
        .bind(serde_json::to_string(&input.redact_headers).unwrap())
        .bind(serde_json::to_string(&input.redact_paths).unwrap())
        .bind(retention)
        .bind(now)
        .execute(&s.pool)
        .await
    {
        Ok(result) => result,
        Err(error) if error.to_string().contains("UNIQUE") => {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "That endpoint alias is already in use.".into(),
            ))
        }
        Err(error) => return Err(error.into()),
    };
    debug_assert_eq!(result.rows_affected(), 1);
    Ok((
        StatusCode::CREATED,
        Json(
            json!({"id":id,"name":input.name,"alias":alias,"token":token,"ingest_path":format!("/ingest/{alias}")}),
        ),
    ))
}

async fn delete_source(
    State(s): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let result = sqlx::query("DELETE FROM sources WHERE id=?")
        .bind(id)
        .execute(&s.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError(StatusCode::NOT_FOUND, "Source not found.".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

struct IngestSource {
    id: String,
    token_hash: String,
    signing_secret: Option<String>,
    redact_headers: String,
    redact_paths: String,
}

impl<'r> FromRow<'r, SqliteRow> for IngestSource {
    fn from_row(row: &'r SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            token_hash: row.try_get("token_hash")?,
            signing_secret: row.try_get("signing_secret")?,
            redact_headers: row.try_get("redact_headers")?,
            redact_paths: row.try_get("redact_paths")?,
        })
    }
}

#[derive(Deserialize, Default)]
struct IngestQuery {
    token: Option<String>,
}

async fn ingest(
    State(s): State<AppState>,
    Path(alias): Path<String>,
    Query(q): Query<IngestQuery>,
    peer: Option<Extension<ConnectInfo<std::net::SocketAddr>>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let source = sqlx::query_as::<_, IngestSource>("SELECT id,token_hash,signing_secret,redact_headers,redact_paths FROM sources WHERE alias=?")
        .bind(&alias).fetch_optional(&s.pool).await?.ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "Unknown endpoint alias.".into()))?;
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::to_owned);
    let provided = headers
        .get("x-ledger-token")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
        .or(bearer)
        .or(q.token);
    let candidate = provided
        .map(|v| sha256_hex(v.as_bytes()))
        .unwrap_or_default();
    if candidate
        .as_bytes()
        .ct_eq(source.token_hash.as_bytes())
        .unwrap_u8()
        != 1
    {
        return Err(ApiError(
            StatusCode::UNAUTHORIZED,
            "A valid endpoint token is required.".into(),
        ));
    }
    if let Some(secret) = &source.signing_secret {
        let signature = headers
            .get("x-ledger-signature")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if !verify_signature(secret.as_bytes(), &body, signature) {
            return Err(ApiError(
                StatusCode::UNAUTHORIZED,
                "The event signature did not match.".into(),
            ));
        }
    }
    let receiver_scope = format!("ingest-auth:{}", source.id);
    if !take_shared_request_token(
        &s.pool,
        &receiver_scope,
        client_ip(&s, peer.as_ref().map(|Extension(peer)| peer), &headers),
        120.0,
        1.0,
    )
    .await?
    {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "This receiver is accepting events too quickly. Try again shortly.".into(),
        ));
    }
    let mut payload: Value = serde_json::from_slice(&body)
        .map_err(|_| ApiError(StatusCode::BAD_REQUEST, "Body must be valid JSON.".into()))?;
    let paths: Vec<String> = serde_json::from_str(&source.redact_paths).unwrap_or_default();
    for path in paths {
        redact_path(&mut payload, &path);
    }
    let hidden_headers: HashSet<String> =
        serde_json::from_str::<Vec<String>>(&source.redact_headers)
            .unwrap_or_default()
            .into_iter()
            .map(|v| v.to_ascii_lowercase())
            .collect();
    let mut kept_headers = serde_json::Map::new();
    for (name, value) in headers.iter() {
        let n = name.as_str().to_ascii_lowercase();
        if matches!(
            n.as_str(),
            "authorization" | "x-ledger-token" | "x-ledger-signature" | "cookie"
        ) {
            continue;
        }
        kept_headers.insert(
            n.clone(),
            if hidden_headers.contains(&n) {
                Value::String("[REDACTED]".into())
            } else {
                Value::String(value.to_str().unwrap_or("[binary]").into())
            },
        );
    }
    let event_type =
        find_string(&payload, &["type", "event", "name"]).unwrap_or_else(|| "event".into());
    let summary = find_string(&payload, &["summary", "message", "title"])
        .unwrap_or_else(|| event_type.clone());
    let supplied_fp = headers
        .get("x-event-fingerprint")
        .and_then(|v| v.to_str().ok())
        .filter(|v| !v.is_empty());
    let fingerprint = supplied_fp
        .map(|v| sha256_hex(v.as_bytes()))
        .unwrap_or_else(|| {
            sha256_hex(format!("{}:{}:{}", source.id, event_type, summary).as_bytes())
        });
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let payload_json = serde_json::to_string(&payload).unwrap();
    let headers_json = Value::Object(kept_headers).to_string();
    sqlx::query(r#"INSERT INTO events(id,source_id,fingerprint,event_type,summary,payload_json,headers_json,received_at,last_seen_at)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,fingerprint) DO UPDATE SET occurrence_count=occurrence_count+1,
        payload_json=excluded.payload_json,headers_json=excluded.headers_json,last_seen_at=excluded.last_seen_at,
        status=CASE WHEN events.status='archived' THEN 'unread' ELSE events.status END"#)
        .bind(&id).bind(&source.id).bind(&fingerprint).bind(truncate(&event_type,80)).bind(truncate(&summary,240))
        .bind(payload_json).bind(headers_json).bind(&now).bind(&now).execute(&s.pool).await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(json!({"accepted":true,"fingerprint":fingerprint})),
    ))
}

/// `X-Forwarded-For` is trusted only behind the detected managed ingress or
/// when the TCP peer is explicitly trusted. Otherwise the direct peer address
/// is used, so callers cannot choose their own rate-limit key with a forged
/// forwarding header.
fn client_ip(
    state: &AppState,
    peer: Option<&ConnectInfo<std::net::SocketAddr>>,
    headers: &HeaderMap,
) -> Option<IpAddr> {
    let peer_ip = peer.map(|peer| peer.0.ip());
    if state.trust_managed_ingress || peer_ip.is_some_and(|ip| is_trusted_proxy(state, ip)) {
        return headers
            .get("x-forwarded-for")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(',').next())
            .and_then(|value| value.trim().parse().ok())
            .or(peer_ip);
    }
    peer_ip
}

fn is_trusted_proxy(state: &AppState, address: IpAddr) -> bool {
    state.trusted_proxy_ips.contains(&address)
        || address.is_loopback()
        || matches!(address, IpAddr::V4(ip) if ip.is_private())
}

#[derive(Deserialize, Default)]
struct EventQuery {
    q: Option<String>,
    source: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

#[derive(Serialize)]
struct EventView {
    id: String,
    source_id: String,
    source_name: String,
    source_alias: String,
    fingerprint: String,
    event_type: String,
    summary: String,
    payload_json: String,
    headers_json: String,
    status: String,
    occurrence_count: i64,
    received_at: String,
    last_seen_at: String,
}

impl<'r> FromRow<'r, SqliteRow> for EventView {
    fn from_row(row: &'r SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            source_id: row.try_get("source_id")?,
            source_name: row.try_get("source_name")?,
            source_alias: row.try_get("source_alias")?,
            fingerprint: row.try_get("fingerprint")?,
            event_type: row.try_get("event_type")?,
            summary: row.try_get("summary")?,
            payload_json: row.try_get("payload_json")?,
            headers_json: row.try_get("headers_json")?,
            status: row.try_get("status")?,
            occurrence_count: row.try_get("occurrence_count")?,
            received_at: row.try_get("received_at")?,
            last_seen_at: row.try_get("last_seen_at")?,
        })
    }
}

async fn list_events(
    State(s): State<AppState>,
    Query(q): Query<EventQuery>,
) -> Result<Json<Value>, ApiError> {
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let search = format!(
        "%{}%",
        q.q.as_deref().unwrap_or_default().to_ascii_lowercase()
    );
    let rows = sqlx::query_as::<_, EventView>(r#"SELECT e.id,e.source_id,s.name source_name,s.alias source_alias,e.fingerprint,e.event_type,e.summary,e.payload_json,e.headers_json,e.status,e.occurrence_count,e.received_at,e.last_seen_at
      FROM events e JOIN sources s ON s.id=e.source_id WHERE (?='' OR lower(e.summary) LIKE ? OR lower(e.event_type) LIKE ? OR lower(e.payload_json) LIKE ?)
      AND (? IS NULL OR e.source_id=?) AND (? IS NULL OR e.status=?) ORDER BY e.last_seen_at DESC LIMIT ?"#)
      .bind(q.q.as_deref().unwrap_or("")).bind(&search).bind(&search).bind(&search)
      .bind(&q.source).bind(&q.source).bind(&q.status).bind(&q.status).bind(limit).fetch_all(&s.pool).await?;
    let unread = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM events WHERE status='unread'")
        .fetch_one(&s.pool)
        .await?;
    Ok(Json(json!({"events":rows,"unread":unread})))
}

#[derive(Deserialize)]
struct StatusUpdate {
    status: String,
}
fn valid_status(s: &str) -> bool {
    matches!(s, "unread" | "acknowledged" | "archived")
}
async fn update_event(
    State(s): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<StatusUpdate>,
) -> Result<Json<Value>, ApiError> {
    if !valid_status(&input.status) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Status must be unread, acknowledged, or archived.".into(),
        ));
    }
    let r = sqlx::query("UPDATE events SET status=? WHERE id=?")
        .bind(&input.status)
        .bind(&id)
        .execute(&s.pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError(StatusCode::NOT_FOUND, "Event not found.".into()));
    }
    Ok(Json(json!({"id":id,"status":input.status})))
}

#[derive(Deserialize)]
struct BulkUpdate {
    ids: Vec<String>,
    status: String,
}
async fn bulk_update_events(
    State(s): State<AppState>,
    Json(input): Json<BulkUpdate>,
) -> Result<Json<Value>, ApiError> {
    if !valid_status(&input.status) || input.ids.is_empty() || input.ids.len() > 500 {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Choose 1–500 events and a valid status.".into(),
        ));
    }
    let mut tx = s.pool.begin().await?;
    let mut changed = 0;
    for id in input.ids {
        changed += sqlx::query("UPDATE events SET status=? WHERE id=?")
            .bind(&input.status)
            .bind(id)
            .execute(&mut *tx)
            .await?
            .rows_affected();
    }
    tx.commit().await?;
    Ok(Json(json!({"updated":changed})))
}

#[derive(Deserialize, Default)]
struct DigestQuery {
    hours: Option<i64>,
}
async fn digest(
    State(s): State<AppState>,
    Query(q): Query<DigestQuery>,
) -> Result<Json<Value>, ApiError> {
    let hours = q.hours.unwrap_or(24);
    if !(1..=168).contains(&hours) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Digest window must be between 1 and 168 hours.".into(),
        ));
    }
    let since = (Utc::now() - Duration::hours(hours)).to_rfc3339();
    let rows=sqlx::query_as::<_,EventView>(r#"SELECT e.id,e.source_id,s.name source_name,s.alias source_alias,e.fingerprint,e.event_type,e.summary,e.payload_json,e.headers_json,e.status,e.occurrence_count,e.received_at,e.last_seen_at FROM events e JOIN sources s ON s.id=e.source_id WHERE e.last_seen_at>=? AND e.status!='archived' ORDER BY e.occurrence_count DESC,e.last_seen_at DESC"#).bind(&since).fetch_all(&s.pool).await?;
    let total: i64 = rows.iter().map(|e| e.occurrence_count).sum();
    let unread = rows.iter().filter(|e| e.status == "unread").count();
    Ok(Json(
        json!({"hours":hours,"generated_at":Utc::now(),"total_occurrences":total,"unread_groups":unread,"events":rows}),
    ))
}

#[derive(Deserialize, Default)]
struct ExportQuery {
    format: Option<String>,
}
async fn export_events(
    State(s): State<AppState>,
    Query(q): Query<ExportQuery>,
) -> Result<Response, ApiError> {
    let rows=sqlx::query_as::<_,EventView>(r#"SELECT e.id,e.source_id,s.name source_name,s.alias source_alias,e.fingerprint,e.event_type,e.summary,e.payload_json,e.headers_json,e.status,e.occurrence_count,e.received_at,e.last_seen_at FROM events e JOIN sources s ON s.id=e.source_id ORDER BY e.last_seen_at DESC"#).fetch_all(&s.pool).await?;
    if q.format.as_deref() == Some("csv") {
        let mut out = String::from(
            "id,source,type,summary,status,occurrences,first_seen,last_seen,fingerprint\n",
        );
        for e in rows {
            out.push_str(
                &[
                    csv(&e.id),
                    csv(&e.source_name),
                    csv(&e.event_type),
                    csv(&e.summary),
                    csv(&e.status),
                    e.occurrence_count.to_string(),
                    csv(&e.received_at),
                    csv(&e.last_seen_at),
                    csv(&e.fingerprint),
                ]
                .join(","),
            );
            out.push('\n');
        }
        Ok((
            [
                (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
                (
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=event-ledger.csv",
                ),
            ],
            out,
        )
            .into_response())
    } else {
        Ok((
            [
                (header::CONTENT_TYPE, "application/json"),
                (
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=event-ledger.json",
                ),
            ],
            serde_json::to_string_pretty(&rows).unwrap(),
        )
            .into_response())
    }
}

#[derive(Serialize)]
struct Settings {
    digest_hour: String,
}
async fn get_settings(State(s): State<AppState>) -> Result<Json<Settings>, ApiError> {
    let v = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key='digest_hour'")
        .fetch_one(&s.pool)
        .await?;
    Ok(Json(Settings { digest_hour: v }))
}
#[derive(Deserialize)]
struct SettingsUpdate {
    digest_hour: String,
}
async fn update_settings(
    State(s): State<AppState>,
    Json(input): Json<SettingsUpdate>,
) -> Result<Json<Settings>, ApiError> {
    if !valid_digest_hour(&input.digest_hour) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Digest time must be HH:MM.".into(),
        ));
    }
    sqlx::query("UPDATE settings SET value=? WHERE key='digest_hour'")
        .bind(&input.digest_hour)
        .execute(&s.pool)
        .await?;
    Ok(Json(Settings {
        digest_hour: input.digest_hour,
    }))
}

fn valid_digest_hour(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 5
        || bytes[2] != b':'
        || !bytes[0..2].iter().all(u8::is_ascii_digit)
        || !bytes[3..5].iter().all(u8::is_ascii_digit)
    {
        return false;
    }
    let hour = (bytes[0] - b'0') * 10 + bytes[1] - b'0';
    let minute = (bytes[3] - b'0') * 10 + bytes[4] - b'0';
    hour <= 23 && minute <= 59
}

async fn run_retention(State(s): State<AppState>) -> Result<Json<Value>, ApiError> {
    let r=sqlx::query("DELETE FROM events WHERE id IN (SELECT e.id FROM events e JOIN sources s ON s.id=e.source_id WHERE julianday('now')-julianday(e.last_seen_at)>s.retention_days)").execute(&s.pool).await?;
    Ok(Json(json!({"deleted":r.rows_affected()})))
}

async fn health() -> Json<Value> {
    Json(json!({"status":"ok","build":env!("BUILD_SHA")}))
}

fn sha256_hex(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}
fn verify_signature(secret: &[u8], body: &[u8], provided: &str) -> bool {
    let value = provided.strip_prefix("sha256=").unwrap_or(provided);
    let Ok(bytes) = hex::decode(value) else {
        return false;
    };
    let Ok(mut mac) = HmacSha256::new_from_slice(secret) else {
        return false;
    };
    mac.update(body);
    mac.verify_slice(&bytes).is_ok()
}
fn find_string(v: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|k| v.get(k).and_then(Value::as_str).map(str::to_owned))
        .filter(|v| !v.is_empty())
}
fn truncate(v: &str, max: usize) -> String {
    v.chars().take(max).collect()
}
fn redact_path(value: &mut Value, path: &str) {
    let parts: Vec<_> = path
        .trim_matches('.')
        .split('.')
        .filter(|p| !p.is_empty())
        .collect();
    if parts.is_empty() {
        return;
    }
    let mut cursor = value;
    for part in &parts[..parts.len() - 1] {
        let Some(next) = cursor.get_mut(*part) else {
            return;
        };
        cursor = next;
    }
    if let Some(obj) = cursor.as_object_mut() {
        if obj.contains_key(parts[parts.len() - 1]) {
            obj.insert(
                parts[parts.len() - 1].into(),
                Value::String("[REDACTED]".into()),
            );
        }
    }
}
fn csv(v: &str) -> String {
    format!("\"{}\"", v.replace('"', "\"\""))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use sqlx::{Connection, SqliteConnection};
    use tower::ServiceExt;

    fn test_state(pool: SqlitePool) -> AppState {
        AppState::new(pool, "test-administrator-token".into())
    }

    fn admin(request: axum::http::request::Builder) -> axum::http::request::Builder {
        request.header("authorization", "Bearer test-administrator-token")
    }

    async fn new_test_router() -> (Router, std::path::PathBuf) {
        let path = std::env::temp_dir().join(format!("ledger-test-{}.db", Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let pool = create_pool(&url).await.unwrap();
        (app(test_state(pool), std::env::temp_dir()), path)
    }

    async fn create_test_source(router: &Router, alias: &str, retention_days: i64) -> Response {
        router
            .clone()
            .oneshot(
                admin(
                    Request::builder()
                        .method("POST")
                        .uri("/api/sources")
                        .header("content-type", "application/json"),
                )
                .body(Body::from(format!(
                    r#"{{"name":"{alias}","alias":"{alias}","retention_days":{retention_days}}}"#
                )))
                .unwrap(),
            )
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn fresh_database_path_starts_while_the_legacy_database_is_locked() {
        let root = std::env::temp_dir().join(format!("ledger-storage-{}", Uuid::new_v4()));
        let legacy_path = root.join("ledger-current.db");
        let legacy_url = sqlite_url(&legacy_path);
        let legacy_pool = create_pool(&legacy_url).await.unwrap();
        legacy_pool.close().await;
        let legacy_size = fs::metadata(&legacy_path).unwrap().len();

        let mut legacy_writer = SqliteConnection::connect(&legacy_url).await.unwrap();
        sqlx::query("BEGIN EXCLUSIVE")
            .execute(&mut legacy_writer)
            .await
            .unwrap();

        let repaired_path = root.join(STORAGE_SUBDIRECTORY).join(DATABASE_FILE_NAME);
        let repaired_pool = tokio::time::timeout(
            StdDuration::from_secs(1),
            create_pool(&sqlite_url(&repaired_path)),
        )
        .await
        .expect("the new database path must not wait for the old lock")
        .unwrap();
        assert!(table_exists(&repaired_pool, "sources").await.unwrap());
        assert_eq!(
            sqlx::query_scalar::<_, String>("PRAGMA journal_mode")
                .fetch_one(&repaired_pool)
                .await
                .unwrap()
                .to_ascii_lowercase(),
            "delete"
        );
        repaired_pool.close().await;

        assert!(legacy_path.exists(), "the locked legacy file is untouched");
        assert_eq!(fs::metadata(&legacy_path).unwrap().len(), legacy_size);
        sqlx::query("ROLLBACK")
            .execute(&mut legacy_writer)
            .await
            .unwrap();
        drop(legacy_writer);
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn startup_lock_retry_is_bounded_and_releases_its_connection() {
        let path = std::env::temp_dir().join(format!("ledger-retry-{}.db", Uuid::new_v4()));
        let url = sqlite_url(&path);
        let initial_pool = create_pool(&url).await.unwrap();
        initial_pool.close().await;

        let mut writer = SqliteConnection::connect(&url).await.unwrap();
        sqlx::query("BEGIN EXCLUSIVE")
            .execute(&mut writer)
            .await
            .unwrap();
        let failed = tokio::time::timeout(
            StdDuration::from_secs(4),
            open_runtime_pool_with_retry(&url, 2, StdDuration::from_millis(10)),
        )
        .await
        .expect("startup retries must end instead of serving 503 forever");
        assert!(failed.is_err());

        sqlx::query("ROLLBACK").execute(&mut writer).await.unwrap();
        drop(writer);
        let reopened = tokio::time::timeout(StdDuration::from_secs(1), create_pool(&url))
            .await
            .expect("a failed startup must release its SQLite connection")
            .unwrap();
        reopened.close().await;
        let _ = fs::remove_file(path);
    }

    #[tokio::test]
    async fn one_connection_persists_ledger_state_after_restart() {
        let root = std::env::temp_dir().join(format!("ledger-persist-{}", Uuid::new_v4()));
        let path = root.join(STORAGE_SUBDIRECTORY).join(DATABASE_FILE_NAME);
        let url = sqlite_url(&path);
        let pool = create_pool(&url).await.unwrap();
        assert_eq!(pool.size(), 1, "the SQLite pool opens one connection");
        sqlx::query("INSERT INTO sources(id,name,alias,token_hash,redact_headers,redact_paths,retention_days,created_at) VALUES(?,?,?,?,?,?,?,?)")
            .bind("restart-source")
            .bind("Restart source")
            .bind("restart-source")
            .bind("token-hash")
            .bind("[]")
            .bind("[]")
            .bind(30_i64)
            .bind(Utc::now().to_rfc3339())
            .execute(&pool)
            .await
            .unwrap();
        pool.close().await;

        let reopened = create_pool(&url).await.unwrap();
        assert_eq!(reopened.size(), 1, "restart still uses one connection");
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM sources WHERE alias='restart-source'"
            )
            .fetch_one(&reopened)
            .await
            .unwrap(),
            1
        );
        reopened.close().await;
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn signatures_are_checked() {
        let body = b"{\"ok\":true}";
        let mut mac = HmacSha256::new_from_slice(b"secret").unwrap();
        mac.update(body);
        let sig = format!("sha256={}", hex::encode(mac.finalize().into_bytes()));
        assert!(verify_signature(b"secret", body, &sig));
        assert!(!verify_signature(b"wrong", body, &sig));
    }
    #[test]
    fn nested_fields_are_redacted() {
        let mut v = json!({"user":{"email":"a@b.test","id":4}});
        redact_path(&mut v, "user.email");
        assert_eq!(v["user"]["email"], "[REDACTED]");
        assert_eq!(v["user"]["id"], 4);
    }
    #[test]
    fn csv_quotes_are_safe() {
        assert_eq!(csv("a,\"b\""), "\"a,\"\"b\"\"\"");
    }
    #[test]
    fn administrator_token_is_generated_once_and_persisted() {
        let directory = std::env::temp_dir().join(format!("ledger-token-{}", Uuid::new_v4()));
        let path = directory.join("admin-token");
        let (generated, source) = load_or_create_admin_token(None, &path).unwrap();
        assert_eq!(source, AdminTokenSource::Generated);
        assert_eq!(generated.len(), 64);
        assert!(generated
            .chars()
            .all(|character| character.is_ascii_hexdigit()));

        let (reloaded, source) = load_or_create_admin_token(None, &path).unwrap();
        assert_eq!(source, AdminTokenSource::Persisted);
        assert_eq!(reloaded, generated);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        let _ = fs::remove_dir_all(directory);
    }
    #[test]
    fn supplied_administrator_token_does_not_touch_disk() {
        let path = std::env::temp_dir().join(format!("ledger-token-{}", Uuid::new_v4()));
        let (token, source) =
            load_or_create_admin_token(Some("operator-supplied".into()), &path).unwrap();
        assert_eq!(source, AdminTokenSource::Supplied);
        assert_eq!(token, "operator-supplied");
        assert!(!path.exists());
    }
    #[tokio::test]
    async fn health_reports_the_nonempty_compiled_build_identity() {
        let (router, path) = new_test_router().await;
        let response = router
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let payload: Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(payload["build"], env!("BUILD_SHA"));
        assert!(!payload["build"].as_str().unwrap().is_empty());
        let _ = fs::remove_file(path);
    }
    #[tokio::test]
    async fn source_ingest_and_review_flow() {
        let (router, path) = new_test_router().await;
        let create = admin(
            Request::builder()
                .method("POST")
                .uri("/api/sources")
                .header("content-type", "application/json"),
        )
        .body(Body::from(
            r#"{"name":"Deploys","alias":"deploys","redact_paths":["user.email"]}"#,
        ))
        .unwrap();
        let response = router.clone().oneshot(create).await.unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
        let created: Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        let token = created["token"].as_str().unwrap();
        let ingest=Request::builder().method("POST").uri("/ingest/deploys").header("content-type","application/json").header("x-ledger-token",token).body(Body::from(r#"{"type":"deploy.ok","summary":"Production ready","user":{"email":"secret@example.test"}}"#)).unwrap();
        let response = router.clone().oneshot(ingest).await.unwrap();
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        let response = router
            .oneshot(
                admin(Request::builder().uri("/api/events"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let events: Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(events["events"][0]["summary"], "Production ready");
        assert!(events["events"][0]["payload_json"]
            .as_str()
            .unwrap()
            .contains("[REDACTED]"));
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn settings_require_exact_hh_mm_and_do_not_persist_invalid_values() {
        let (router, path) = new_test_router().await;
        for invalid in ["7:00", "07:0", "7:0", "07:000", "24:00", "23:60", "ab:cd"] {
            let response = router
                .clone()
                .oneshot(
                    admin(
                        Request::builder()
                            .method("PUT")
                            .uri("/api/settings")
                            .header("content-type", "application/json"),
                    )
                    .body(Body::from(format!(r#"{{"digest_hour":"{invalid}"}}"#)))
                    .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(
                response.status(),
                StatusCode::BAD_REQUEST,
                "accepted {invalid}"
            );
        }

        let unchanged = router
            .clone()
            .oneshot(
                admin(Request::builder().uri("/api/settings"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let unchanged: Value =
            serde_json::from_slice(&unchanged.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(unchanged["digest_hour"], "09:00");

        let accepted = router
            .clone()
            .oneshot(
                admin(
                    Request::builder()
                        .method("PUT")
                        .uri("/api/settings")
                        .header("content-type", "application/json"),
                )
                .body(Body::from(r#"{"digest_hour":"07:00"}"#))
                .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(accepted.status(), StatusCode::OK);
        let accepted: Value =
            serde_json::from_slice(&accepted.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(accepted["digest_hour"], "07:00");
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn administrator_authentication_protects_every_management_route() {
        let (router, path) = new_test_router().await;
        for request in [
            Request::builder()
                .uri("/api/sources")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .uri("/api/events")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .uri("/api/digest")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .uri("/api/export?format=csv")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .uri("/api/settings")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .method("POST")
                .uri("/api/sources")
                .body(Body::from("{}"))
                .unwrap(),
            Request::builder()
                .method("PATCH")
                .uri("/api/events/id")
                .body(Body::from("{}"))
                .unwrap(),
            Request::builder()
                .method("DELETE")
                .uri("/api/sources/id")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .method("POST")
                .uri("/api/maintenance/retention")
                .body(Body::from("{}"))
                .unwrap(),
        ] {
            let response = router.clone().oneshot(request).await.unwrap();
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }
        let response = create_test_source(&router, "protected-source", 30).await;
        assert_eq!(response.status(), StatusCode::CREATED);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn server_keeps_source_and_digest_controls_local() {
        let (router, path) = new_test_router().await;
        for index in 0..6 {
            let response = create_test_source(&router, &format!("source-{index}"), 3650).await;
            assert_eq!(response.status(), StatusCode::CREATED);
        }
        let digest = router
            .clone()
            .oneshot(
                admin(Request::builder().uri("/api/digest?hours=6"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(digest.status(), StatusCode::OK);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn simultaneous_source_creation_keeps_every_successful_source() {
        let (router, path) = new_test_router().await;
        let mut requests = tokio::task::JoinSet::new();
        for index in 0..20 {
            let router = router.clone();
            requests.spawn(async move {
                create_test_source(&router, &format!("concurrent-{index}"), 30)
                    .await
                    .status()
            });
        }
        let mut created = 0;
        while let Some(result) = requests.join_next().await {
            match result.unwrap() {
                StatusCode::CREATED => created += 1,
                status => panic!("unexpected concurrent creation response: {status}"),
            }
        }
        assert_eq!(created, 20);
        let response = router
            .oneshot(
                admin(Request::builder().uri("/api/sources"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let payload: Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(payload["sources"].as_array().unwrap().len(), 20);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn anonymous_ingest_flood_cannot_spend_a_valid_receivers_quota() {
        let (router, path) = new_test_router().await;
        let created = create_test_source(&router, "isolated-receiver", 30).await;
        let payload: Value =
            serde_json::from_slice(&created.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        let token = payload["token"].as_str().unwrap().to_owned();
        for _ in 0..160 {
            let response = router
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/ingest/nonexistent")
                        .header("content-type", "application/json")
                        .body(Body::from(r#"{"summary":"noise"}"#))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
        let response = router
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/ingest/isolated-receiver")
                    .header("content-type", "application/json")
                    .header("x-ledger-token", token)
                    .body(Body::from(r#"{"summary":"accepted after flood"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn ingest_rate_limit_returns_retry_after() {
        let (router, path) = new_test_router().await;
        let created = create_test_source(&router, "rate-limited-receiver", 30).await;
        let payload: Value =
            serde_json::from_slice(&created.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        let token = payload["token"].as_str().unwrap();
        let mut limited = None;
        for index in 0..140 {
            let response = router
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/ingest/rate-limited-receiver")
                        .header("content-type", "application/json")
                        .header("x-ledger-token", token)
                        .header("x-event-fingerprint", format!("rate-{index}"))
                        .body(Body::from(r#"{"summary":"rate policy"}"#))
                        .unwrap(),
                )
                .await
                .unwrap();
            if response.status() == StatusCode::TOO_MANY_REQUESTS {
                limited = Some(response);
                break;
            }
            assert_eq!(response.status(), StatusCode::ACCEPTED);
        }
        let limited = limited.expect("authenticated burst must reach the receiver rate limit");
        assert_eq!(limited.headers()[header::RETRY_AFTER], "1");
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn management_rate_limit_wraps_authenticated_and_anonymous_requests() {
        for authenticated in [true, false] {
            let (router, path) = new_test_router().await;
            let mut limited = None;
            for _ in 0..220 {
                let request = Request::builder().uri("/api/events");
                let request = if authenticated {
                    admin(request)
                } else {
                    request
                };
                let response = router
                    .clone()
                    .oneshot(request.body(Body::empty()).unwrap())
                    .await
                    .unwrap();
                if response.status() == StatusCode::TOO_MANY_REQUESTS {
                    limited = Some(response);
                    break;
                }
                assert_eq!(
                    response.status(),
                    if authenticated {
                        StatusCode::OK
                    } else {
                        StatusCode::UNAUTHORIZED
                    }
                );
            }
            let limited = limited.expect("every management client must reach the API limit");
            assert_eq!(limited.headers()[header::RETRY_AFTER], "1");
            let _ = std::fs::remove_file(path);
        }
    }

    #[tokio::test]
    async fn demo_workspace_is_random_ephemeral_and_never_reads_production_tables() {
        let (router, path) = new_test_router().await;
        assert_eq!(
            create_test_source(&router, "private-production-source", 30)
                .await
                .status(),
            StatusCode::CREATED
        );

        let first = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/demo")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first.status(), StatusCode::OK);
        let first: Value =
            serde_json::from_slice(&first.into_body().collect().await.unwrap().to_bytes()).unwrap();
        let first_id = first["workspace_id"].as_str().unwrap();
        assert_eq!(first["sources"].as_array().unwrap().len(), 3);
        assert_eq!(first["events"].as_array().unwrap().len(), 5);
        assert!(!first.to_string().contains("private-production-source"));

        let second = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/demo")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let second: Value =
            serde_json::from_slice(&second.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_ne!(first_id, second["workspace_id"].as_str().unwrap());

        let removed = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/demo/{first_id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(removed.status(), StatusCode::NO_CONTENT);
        let missing = router
            .oneshot(
                Request::builder()
                    .uri(format!("/api/demo/{first_id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing.status(), StatusCode::NOT_FOUND);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn unknown_routes_return_the_designed_404_document() {
        let (router, path) = new_test_router().await;
        let response = router
            .oneshot(
                Request::builder()
                    .uri("/does-not-exist")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        assert!(String::from_utf8_lossy(&body).contains("This route is not on the board"));
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn forwarded_addresses_are_used_only_for_trusted_ingress() {
        let pool = SqlitePoolOptions::new()
            .connect_lazy("sqlite::memory:")
            .unwrap();
        let trusted = "127.0.0.1".parse().unwrap();
        let state = test_state(pool).with_trusted_proxy_ips(HashSet::from([trusted]));
        let peer = ConnectInfo(std::net::SocketAddr::from(([127, 0, 0, 1], 8080)));
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", "203.0.113.10".parse().unwrap());
        assert_eq!(
            client_ip(&state, Some(&peer), &headers),
            Some("203.0.113.10".parse().unwrap())
        );
        let untrusted = test_state(
            SqlitePoolOptions::new()
                .connect_lazy("sqlite::memory:")
                .unwrap(),
        );
        let public_peer = ConnectInfo(std::net::SocketAddr::from((
            "198.51.100.7".parse::<IpAddr>().unwrap(),
            8080,
        )));
        assert_eq!(
            client_ip(&untrusted, Some(&public_peer), &headers),
            Some("198.51.100.7".parse().unwrap())
        );
        let managed = test_state(
            SqlitePoolOptions::new()
                .connect_lazy("sqlite::memory:")
                .unwrap(),
        )
        .with_managed_ingress(true);
        assert_eq!(
            client_ip(&managed, Some(&public_peer), &headers),
            Some("203.0.113.10".parse().unwrap())
        );
    }

    #[tokio::test]
    async fn cache_policy_marks_hashed_assets_immutable_and_shell_revalidates() {
        assert!(is_hashed_asset("/assets/index-Abc12345.js"));
        assert!(!is_hashed_asset("/assets/dispatch-hall.webp"));
        let (_router, database_path) = new_test_router().await;
        let cache_path = std::env::temp_dir().join(format!("ledger-static-{}", Uuid::new_v4()));
        std::fs::create_dir_all(cache_path.join("assets")).unwrap();
        std::fs::write(
            cache_path.join("index.html"),
            "<!doctype html><title>Ledger</title>",
        )
        .unwrap();
        std::fs::write(
            cache_path.join("assets/index-Abc12345.js"),
            "console.log('ledger')",
        )
        .unwrap();
        std::fs::write(cache_path.join("sw.js"), "// worker").unwrap();
        let url = format!("sqlite://{}?mode=rwc", database_path.display());
        let static_router = app(
            test_state(create_pool(&url).await.unwrap()),
            cache_path.clone(),
        );
        let shell = static_router
            .clone()
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(shell.headers()[header::CACHE_CONTROL], "no-cache");
        assert_eq!(
            shell.headers()["strict-transport-security"],
            "max-age=31536000"
        );
        let asset = static_router
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/assets/index-Abc12345.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            asset.headers()[header::CACHE_CONTROL],
            "public, max-age=31536000, immutable"
        );
        let worker = static_router
            .oneshot(
                Request::builder()
                    .uri("/sw.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(worker.headers()[header::CACHE_CONTROL], "no-cache");
        let _ = std::fs::remove_dir_all(cache_path);
        let _ = std::fs::remove_file(database_path);
    }
}
