use axum::{
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{header, HeaderMap, HeaderValue, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{sqlite::SqlitePoolOptions, FromRow, SqlitePool};
use std::{collections::HashSet, path::PathBuf};
use subtle::ConstantTimeEq;
use tower_http::{catch_panic::CatchPanicLayer, limit::RequestBodyLimitLayer, services::{ServeDir, ServeFile}, trace::TraceLayer};
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone)]
pub struct AppState { pub pool: SqlitePool }

pub async fn create_pool(url: &str) -> anyhow::Result<SqlitePool> {
    let pool = SqlitePoolOptions::new().max_connections(8).connect(url).await?;
    sqlx::migrate!().run(&pool).await?;
    Ok(pool)
}

pub fn app(state: AppState, static_dir: PathBuf) -> Router {
    let index = static_dir.join("index.html");
    let api = Router::new()
        .route("/sources", get(list_sources).post(create_source))
        .route("/sources/{id}", delete(delete_source))
        .route("/events", get(list_events).patch(bulk_update_events))
        .route("/events/{id}", patch(update_event))
        .route("/digest", get(digest))
        .route("/export", get(export_events))
        .route("/settings", get(get_settings).put(update_settings))
        .route("/maintenance/retention", post(run_retention));
    Router::new()
        .route("/health", get(health))
        .route("/ingest/{alias}", post(ingest))
        .nest("/api", api)
        .fallback_service(ServeDir::new(static_dir).not_found_service(ServeFile::new(index)))
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(256 * 1024))
        .layer(middleware::from_fn(security_headers))
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn security_headers(req: Request<Body>, next: Next) -> Response {
    let mut response = next.run(req).await;
    let h = response.headers_mut();
    h.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    h.insert("x-frame-options", HeaderValue::from_static("DENY"));
    h.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    h.insert("permissions-policy", HeaderValue::from_static("camera=(), microphone=(), geolocation=()"));
    h.insert("content-security-policy", HeaderValue::from_static("default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.sociobot.in; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.sociobot.in"));
    response
}

#[derive(Debug)]
struct ApiError(StatusCode, String);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response { (self.0, Json(json!({"error": self.1}))).into_response() }
}
impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!(%error, "database error");
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, "The ledger database could not complete that request.".into())
    }
}

#[derive(Serialize, FromRow)]
struct SourceView {
    id: String, name: String, alias: String, redact_headers: String, redact_paths: String,
    retention_days: i64, created_at: String, event_count: i64, unread_count: i64,
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
    name: String, alias: String, signing_secret: Option<String>,
    #[serde(default)] redact_headers: Vec<String>, #[serde(default)] redact_paths: Vec<String>, retention_days: Option<i64>,
}

async fn create_source(State(s): State<AppState>, Json(input): Json<NewSource>) -> Result<(StatusCode, Json<Value>), ApiError> {
    let alias = input.alias.trim().to_ascii_lowercase();
    if input.name.trim().is_empty() || input.name.len() > 80 { return Err(ApiError(StatusCode::BAD_REQUEST, "Name must be between 1 and 80 characters.".into())); }
    if alias.len() < 2 || alias.len() > 48 || !alias.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Alias must be 2–48 lowercase letters, numbers, or hyphens.".into()));
    }
    if input.redact_headers.len() > 32 || input.redact_paths.len() > 32 { return Err(ApiError(StatusCode::BAD_REQUEST, "Use at most 32 redaction rules of each type.".into())); }
    let retention = input.retention_days.unwrap_or(30);
    if !(1..=3650).contains(&retention) { return Err(ApiError(StatusCode::BAD_REQUEST, "Retention must be between 1 and 3650 days.".into())); }
    let mut raw = [0u8; 24]; rand::rng().fill_bytes(&mut raw);
    let token = hex::encode(raw);
    let token_hash = sha256_hex(token.as_bytes());
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let result = sqlx::query("INSERT INTO sources(id,name,alias,token_hash,signing_secret,redact_headers,redact_paths,retention_days,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(&id).bind(input.name.trim()).bind(&alias).bind(token_hash).bind(input.signing_secret.filter(|v| !v.is_empty()))
        .bind(serde_json::to_string(&input.redact_headers).unwrap()).bind(serde_json::to_string(&input.redact_paths).unwrap())
        .bind(retention).bind(now).execute(&s.pool).await;
    if let Err(e) = result {
        if e.to_string().contains("UNIQUE") { return Err(ApiError(StatusCode::CONFLICT, "That endpoint alias is already in use.".into())); }
        return Err(e.into());
    }
    Ok((StatusCode::CREATED, Json(json!({"id":id,"name":input.name,"alias":alias,"token":token,"ingest_path":format!("/ingest/{alias}")}))))
}

async fn delete_source(State(s): State<AppState>, Path(id): Path<String>) -> Result<StatusCode, ApiError> {
    let result = sqlx::query("DELETE FROM sources WHERE id=?").bind(id).execute(&s.pool).await?;
    if result.rows_affected() == 0 { return Err(ApiError(StatusCode::NOT_FOUND, "Source not found.".into())); }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(FromRow)]
struct IngestSource { id: String, token_hash: String, signing_secret: Option<String>, redact_headers: String, redact_paths: String }

#[derive(Deserialize, Default)]
struct IngestQuery { token: Option<String> }

async fn ingest(State(s): State<AppState>, Path(alias): Path<String>, Query(q): Query<IngestQuery>, headers: HeaderMap, body: Bytes) -> Result<(StatusCode, Json<Value>), ApiError> {
    let source = sqlx::query_as::<_, IngestSource>("SELECT id,token_hash,signing_secret,redact_headers,redact_paths FROM sources WHERE alias=?")
        .bind(&alias).fetch_optional(&s.pool).await?.ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "Unknown endpoint alias.".into()))?;
    let bearer = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()).and_then(|v| v.strip_prefix("Bearer ")).map(str::to_owned);
    let provided = headers.get("x-ledger-token").and_then(|v| v.to_str().ok()).map(str::to_owned).or(bearer).or(q.token);
    let candidate = provided.map(|v| sha256_hex(v.as_bytes())).unwrap_or_default();
    if candidate.as_bytes().ct_eq(source.token_hash.as_bytes()).unwrap_u8() != 1 {
        return Err(ApiError(StatusCode::UNAUTHORIZED, "A valid endpoint token is required.".into()));
    }
    if let Some(secret) = &source.signing_secret {
        let signature = headers.get("x-ledger-signature").and_then(|v| v.to_str().ok()).unwrap_or("");
        if !verify_signature(secret.as_bytes(), &body, signature) { return Err(ApiError(StatusCode::UNAUTHORIZED, "The event signature did not match.".into())); }
    }
    let mut payload: Value = serde_json::from_slice(&body).map_err(|_| ApiError(StatusCode::BAD_REQUEST, "Body must be valid JSON.".into()))?;
    let paths: Vec<String> = serde_json::from_str(&source.redact_paths).unwrap_or_default();
    for path in paths { redact_path(&mut payload, &path); }
    let hidden_headers: HashSet<String> = serde_json::from_str::<Vec<String>>(&source.redact_headers).unwrap_or_default().into_iter().map(|v| v.to_ascii_lowercase()).collect();
    let mut kept_headers = serde_json::Map::new();
    for (name, value) in headers.iter() {
        let n = name.as_str().to_ascii_lowercase();
        if matches!(n.as_str(), "authorization" | "x-ledger-token" | "x-ledger-signature" | "cookie") { continue; }
        kept_headers.insert(n.clone(), if hidden_headers.contains(&n) { Value::String("[REDACTED]".into()) } else { Value::String(value.to_str().unwrap_or("[binary]").into()) });
    }
    let event_type = find_string(&payload, &["type","event","name"]).unwrap_or_else(|| "event".into());
    let summary = find_string(&payload, &["summary","message","title"]).unwrap_or_else(|| event_type.clone());
    let supplied_fp = headers.get("x-event-fingerprint").and_then(|v| v.to_str().ok()).filter(|v| !v.is_empty());
    let fingerprint = supplied_fp.map(|v| sha256_hex(v.as_bytes())).unwrap_or_else(|| sha256_hex(format!("{}:{}:{}", source.id, event_type, summary).as_bytes()));
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
    Ok((StatusCode::ACCEPTED, Json(json!({"accepted":true,"fingerprint":fingerprint}))))
}

#[derive(Deserialize, Default)]
struct EventQuery { q: Option<String>, source: Option<String>, status: Option<String>, limit: Option<i64> }

#[derive(Serialize, FromRow)]
struct EventView { id:String, source_id:String, source_name:String, source_alias:String, fingerprint:String, event_type:String, summary:String, payload_json:String, headers_json:String, status:String, occurrence_count:i64, received_at:String, last_seen_at:String }

async fn list_events(State(s): State<AppState>, Query(q): Query<EventQuery>) -> Result<Json<Value>, ApiError> {
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let search = format!("%{}%", q.q.as_deref().unwrap_or_default().to_ascii_lowercase());
    let rows = sqlx::query_as::<_, EventView>(r#"SELECT e.id,e.source_id,s.name source_name,s.alias source_alias,e.fingerprint,e.event_type,e.summary,e.payload_json,e.headers_json,e.status,e.occurrence_count,e.received_at,e.last_seen_at
      FROM events e JOIN sources s ON s.id=e.source_id WHERE (?='' OR lower(e.summary) LIKE ? OR lower(e.event_type) LIKE ? OR lower(e.payload_json) LIKE ?)
      AND (? IS NULL OR e.source_id=?) AND (? IS NULL OR e.status=?) ORDER BY e.last_seen_at DESC LIMIT ?"#)
      .bind(q.q.as_deref().unwrap_or("")).bind(&search).bind(&search).bind(&search)
      .bind(&q.source).bind(&q.source).bind(&q.status).bind(&q.status).bind(limit).fetch_all(&s.pool).await?;
    let unread = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM events WHERE status='unread'").fetch_one(&s.pool).await?;
    Ok(Json(json!({"events":rows,"unread":unread})))
}

#[derive(Deserialize)] struct StatusUpdate { status: String }
fn valid_status(s: &str) -> bool { matches!(s, "unread"|"acknowledged"|"archived") }
async fn update_event(State(s): State<AppState>, Path(id): Path<String>, Json(input): Json<StatusUpdate>) -> Result<Json<Value>, ApiError> {
    if !valid_status(&input.status) { return Err(ApiError(StatusCode::BAD_REQUEST, "Status must be unread, acknowledged, or archived.".into())); }
    let r = sqlx::query("UPDATE events SET status=? WHERE id=?").bind(&input.status).bind(&id).execute(&s.pool).await?;
    if r.rows_affected()==0 { return Err(ApiError(StatusCode::NOT_FOUND, "Event not found.".into())); }
    Ok(Json(json!({"id":id,"status":input.status})))
}

#[derive(Deserialize)] struct BulkUpdate { ids: Vec<String>, status: String }
async fn bulk_update_events(State(s): State<AppState>, Json(input): Json<BulkUpdate>) -> Result<Json<Value>, ApiError> {
    if !valid_status(&input.status) || input.ids.is_empty() || input.ids.len()>500 { return Err(ApiError(StatusCode::BAD_REQUEST, "Choose 1–500 events and a valid status.".into())); }
    let mut tx=s.pool.begin().await?; let mut changed=0;
    for id in input.ids { changed += sqlx::query("UPDATE events SET status=? WHERE id=?").bind(&input.status).bind(id).execute(&mut *tx).await?.rows_affected(); }
    tx.commit().await?; Ok(Json(json!({"updated":changed})))
}

#[derive(Deserialize, Default)] struct DigestQuery { hours: Option<i64> }
async fn digest(State(s): State<AppState>, Query(q): Query<DigestQuery>) -> Result<Json<Value>, ApiError> {
    let hours=q.hours.unwrap_or(24).clamp(1,168); let since=(Utc::now()-Duration::hours(hours)).to_rfc3339();
    let rows=sqlx::query_as::<_,EventView>(r#"SELECT e.id,e.source_id,s.name source_name,s.alias source_alias,e.fingerprint,e.event_type,e.summary,e.payload_json,e.headers_json,e.status,e.occurrence_count,e.received_at,e.last_seen_at FROM events e JOIN sources s ON s.id=e.source_id WHERE e.last_seen_at>=? AND e.status!='archived' ORDER BY e.occurrence_count DESC,e.last_seen_at DESC"#).bind(&since).fetch_all(&s.pool).await?;
    let total: i64=rows.iter().map(|e|e.occurrence_count).sum(); let unread=rows.iter().filter(|e|e.status=="unread").count();
    Ok(Json(json!({"hours":hours,"generated_at":Utc::now(),"total_occurrences":total,"unread_groups":unread,"events":rows})))
}

#[derive(Deserialize, Default)] struct ExportQuery { format: Option<String> }
async fn export_events(State(s): State<AppState>, Query(q): Query<ExportQuery>) -> Result<Response, ApiError> {
    let rows=sqlx::query_as::<_,EventView>(r#"SELECT e.id,e.source_id,s.name source_name,s.alias source_alias,e.fingerprint,e.event_type,e.summary,e.payload_json,e.headers_json,e.status,e.occurrence_count,e.received_at,e.last_seen_at FROM events e JOIN sources s ON s.id=e.source_id ORDER BY e.last_seen_at DESC"#).fetch_all(&s.pool).await?;
    if q.format.as_deref()==Some("csv") {
        let mut out=String::from("id,source,type,summary,status,occurrences,first_seen,last_seen,fingerprint\n");
        for e in rows { out.push_str(&[csv(&e.id),csv(&e.source_name),csv(&e.event_type),csv(&e.summary),csv(&e.status),e.occurrence_count.to_string(),csv(&e.received_at),csv(&e.last_seen_at),csv(&e.fingerprint)].join(",")); out.push('\n'); }
        Ok(([(header::CONTENT_TYPE,"text/csv; charset=utf-8"),(header::CONTENT_DISPOSITION,"attachment; filename=event-ledger.csv")],out).into_response())
    } else { Ok(([(header::CONTENT_TYPE,"application/json"),(header::CONTENT_DISPOSITION,"attachment; filename=event-ledger.json")],serde_json::to_string_pretty(&rows).unwrap()).into_response()) }
}

#[derive(Serialize)] struct Settings { digest_hour:String }
async fn get_settings(State(s):State<AppState>)->Result<Json<Settings>,ApiError>{ let v=sqlx::query_scalar::<_,String>("SELECT value FROM settings WHERE key='digest_hour'").fetch_one(&s.pool).await?; Ok(Json(Settings{digest_hour:v})) }
#[derive(Deserialize)] struct SettingsUpdate { digest_hour:String }
async fn update_settings(State(s):State<AppState>,Json(input):Json<SettingsUpdate>)->Result<Json<Settings>,ApiError>{
    let parts:Vec<_>=input.digest_hour.split(':').collect(); if parts.len()!=2 || parts[0].parse::<u8>().map_or(true,|v|v>23) || parts[1].parse::<u8>().map_or(true,|v|v>59){return Err(ApiError(StatusCode::BAD_REQUEST,"Digest time must be HH:MM.".into()));}
    sqlx::query("UPDATE settings SET value=? WHERE key='digest_hour'").bind(&input.digest_hour).execute(&s.pool).await?; Ok(Json(Settings{digest_hour:input.digest_hour}))
}

async fn run_retention(State(s):State<AppState>)->Result<Json<Value>,ApiError>{ let r=sqlx::query("DELETE FROM events WHERE id IN (SELECT e.id FROM events e JOIN sources s ON s.id=e.source_id WHERE julianday('now')-julianday(e.last_seen_at)>s.retention_days)").execute(&s.pool).await?; Ok(Json(json!({"deleted":r.rows_affected()}))) }

async fn health()->Json<Value>{Json(json!({"status":"ok","build":option_env!("BUILD_SHA").unwrap_or("dev")}))}

fn sha256_hex(data:&[u8])->String{hex::encode(Sha256::digest(data))}
fn verify_signature(secret:&[u8], body:&[u8], provided:&str)->bool{ let value=provided.strip_prefix("sha256=").unwrap_or(provided); let Ok(bytes)=hex::decode(value) else{return false}; let Ok(mut mac)=HmacSha256::new_from_slice(secret) else{return false}; mac.update(body); mac.verify_slice(&bytes).is_ok() }
fn find_string(v:&Value,keys:&[&str])->Option<String>{keys.iter().find_map(|k|v.get(k).and_then(Value::as_str).map(str::to_owned)).filter(|v|!v.is_empty())}
fn truncate(v:&str,max:usize)->String{v.chars().take(max).collect()}
fn redact_path(value:&mut Value,path:&str){ let parts:Vec<_>=path.trim_matches('.').split('.').filter(|p|!p.is_empty()).collect(); if parts.is_empty(){return} let mut cursor=value; for part in &parts[..parts.len()-1]{let Some(next)=cursor.get_mut(*part) else{return};cursor=next;} if let Some(obj)=cursor.as_object_mut(){if obj.contains_key(parts[parts.len()-1]){obj.insert(parts[parts.len()-1].into(),Value::String("[REDACTED]".into()));}}}
fn csv(v:&str)->String{format!("\"{}\"",v.replace('"',"\"\""))}

#[cfg(test)]
mod tests{
 use super::*;
 use axum::http::Request;
 use http_body_util::BodyExt;
 use tower::ServiceExt;
 #[test] fn signatures_are_checked(){let body=b"{\"ok\":true}";let mut mac=HmacSha256::new_from_slice(b"secret").unwrap();mac.update(body);let sig=format!("sha256={}",hex::encode(mac.finalize().into_bytes()));assert!(verify_signature(b"secret",body,&sig));assert!(!verify_signature(b"wrong",body,&sig));}
 #[test] fn nested_fields_are_redacted(){let mut v=json!({"user":{"email":"a@b.test","id":4}});redact_path(&mut v,"user.email");assert_eq!(v["user"]["email"],"[REDACTED]");assert_eq!(v["user"]["id"],4);}
 #[test] fn csv_quotes_are_safe(){assert_eq!(csv("a,\"b\""),"\"a,\"\"b\"\"\"");}
 #[tokio::test]
 async fn source_ingest_and_review_flow(){
   let path=std::env::temp_dir().join(format!("ledger-test-{}.db",Uuid::new_v4()));
   let url=format!("sqlite://{}?mode=rwc",path.display());
   let pool=create_pool(&url).await.unwrap();
   let router=app(AppState{pool},std::env::temp_dir());
   let create=Request::builder().method("POST").uri("/api/sources").header("content-type","application/json").body(Body::from(r#"{"name":"Deploys","alias":"deploys","redact_paths":["user.email"]}"#)).unwrap();
   let response=router.clone().oneshot(create).await.unwrap(); assert_eq!(response.status(),StatusCode::CREATED);
   let created:Value=serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
   let token=created["token"].as_str().unwrap();
   let ingest=Request::builder().method("POST").uri("/ingest/deploys").header("content-type","application/json").header("x-ledger-token",token).body(Body::from(r#"{"type":"deploy.ok","summary":"Production ready","user":{"email":"secret@example.test"}}"#)).unwrap();
   let response=router.clone().oneshot(ingest).await.unwrap(); assert_eq!(response.status(),StatusCode::ACCEPTED);
   let response=router.oneshot(Request::builder().uri("/api/events").body(Body::empty()).unwrap()).await.unwrap(); assert_eq!(response.status(),StatusCode::OK);
   let events:Value=serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
   assert_eq!(events["events"][0]["summary"],"Production ready");
   assert!(events["events"][0]["payload_json"].as_str().unwrap().contains("[REDACTED]"));
   let _=std::fs::remove_file(path);
 }
}
