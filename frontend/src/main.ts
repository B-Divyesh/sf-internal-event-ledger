import './styles.css';
import { escapeHtml, isPublicLegalView, parseJson, relativeTime, slugify } from './lib';

type Source = { id:string; name:string; alias:string; redact_headers:string; redact_paths:string; retention_days:number; created_at:string; event_count:number; unread_count:number };
type EventItem = { id:string; source_id:string; source_name:string; source_alias:string; fingerprint:string; event_type:string; summary:string; payload_json:string; headers_json:string; status:'unread'|'acknowledged'|'archived'; occurrence_count:number; received_at:string; last_seen_at:string };
type Digest = { hours:number; generated_at:string; total_occurrences:number; unread_groups:number; events:EventItem[] };
type View = 'inbox'|'sources'|'digest'|'settings'|'privacy'|'terms';
type DemoWorkspace = { workspace_id:string; expires_in_seconds:number; digest_hour:string; sources:Source[]; events:EventItem[] };

const ADMIN_TOKEN_KEY = 'iel:admin-token';
const DEMO_KEY = 'demo:internal-event-ledger:workspace';
const BUILD_SHA = __BUILD_SHA__;
const APP_VIEWS = ['inbox','sources','digest','settings'] as const;
const startsInDemo = isDemoRoute() || new URLSearchParams(location.search).get('demo') === '1';
const state = {
  view: routeView(), sources: [] as Source[], events: [] as EventItem[], digest: null as Digest|null,
  selectedSource: '', status: 'active', search: '', loading: true, error: '', online: navigator.onLine,
  openEvent: '', selected: new Set<string>(), credential: null as null|{alias:string;token:string;path:string},
  digestHour: '09:00', digestHours: 24, accessRequired: !sessionStored(ADMIN_TOKEN_KEY) && !startsInDemo,
  adminToken: sessionStored(ADMIN_TOKEN_KEY) || '',
  demoMode: startsInDemo, demoId: '', demoEvents: [] as EventItem[], demoStartedAt: 0,
};

const app = document.querySelector<HTMLDivElement>('#app')!;

function routeView(): View {
  if (location.pathname === '/privacy') return 'privacy';
  if (location.pathname === '/terms') return 'terms';
  const path = isDemoRoute() ? location.pathname.slice('/demo'.length) : location.pathname;
  const view = path.replace(/^\/+/, '');
  return APP_VIEWS.includes(view as typeof APP_VIEWS[number]) ? view as View : 'inbox';
}

function isDemoRoute(path=location.pathname):boolean { return path === '/demo' || path.startsWith('/demo/'); }
function routeUrl(view:View):string {
  if (isPublicLegalView(view)) return `/${view}`;
  if (!state.demoMode) return `/${view}`;
  return view === 'inbox' ? '/demo' : `/demo/${view}`;
}

async function api<T>(url:string, options?:RequestInit):Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'content-type':'application/json', ...(state.adminToken ? {authorization:`Bearer ${state.adminToken}`} : {}), ...(options?.headers || {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {error?:string};
    throw new ApiRequestError(response.status, body.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

class ApiRequestError extends Error { constructor(readonly status:number, message:string){super(message);} }
function messageFor(error:unknown):string {
  if (error instanceof ApiRequestError && error.status===401) { state.accessRequired=true; return 'Administrator authentication is required.'; }
  return (error as Error).message;
}
function sessionStored(key:string):string|null{try{return sessionStorage.getItem(key);}catch{return null;}}

function layout(content:string):string {
  const unread = state.events.filter((e) => e.status === 'unread').length;
  const demoBanner = state.demoMode ? `<div class="demo-banner" role="status"><strong>Demo — sample data, nothing is saved to your real ledger</strong><span>Workspace ${escapeHtml(state.demoId.slice(0,8))}</span><div class="actions"><button class="button" id="reset-demo">Reset demo</button><button class="button demo-exit" data-start-real>Start for real</button></div></div>` : '';
  return `<div class="${state.demoMode?'demo-mode':''}">${demoBanner}<div class="shell">
    <aside class="sidebar" aria-label="Product navigation">
      <a class="brand" href="${routeUrl('inbox')}" data-route="inbox" aria-label="Internal Event Ledger home">
        <span class="brand-mark" aria-hidden="true"><span>IEL</span></span>
        <span class="brand-copy">Internal event<small>Webhook review</small></span>
      </a>
      <p class="nav-label">Ledger sections</p>
      <nav class="main-nav" aria-label="Ledger sections">
        ${nav('inbox',`Inbox${unread ? ` · ${unread}`:''}`)}
        ${nav('sources','Sources')}
        ${nav('digest','Digest')}
        ${nav('settings','Settings')}
      </nav>
      <div class="source-route">
        <p class="nav-label">Sources</p>
        <div class="source-list">
          <button class="source-filter ${state.selectedSource===''?'selected':''}" data-source=""><span class="route-dot"></span>All sources<span class="source-count">${state.sources.length}</span></button>
          ${state.sources.map((s) => `<button class="source-filter ${state.selectedSource===s.id?'selected':''}" data-source="${s.id}"><span class="route-dot"></span>${escapeHtml(s.name)}<span class="source-count">${s.unread_count}</span></button>`).join('')}
        </div>
      </div>
      <div class="sidebar-foot">${state.demoMode?'Sample workspace · expires in 24 hours':'Self-hosted · private by default'}<br><a href="/privacy" data-legal="privacy">Privacy</a> · <a href="/terms" data-legal="terms">Terms</a></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><span class="connection ${state.online?'':'offline'}">${state.online?(state.demoMode?'Sample ledger ready':'Receiver connected'):'Offline — showing last view'}</span><span class="clock">${new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short'}).format(new Date())}</span></header>
      <main id="main" tabindex="-1">${state.error?`<div class="notice" role="alert">${escapeHtml(state.error)} <button class="button quiet" id="retry">Try again</button></div>`:''}${content}</main>
      ${appFooter()}
    </div>
    <div class="toast-region" aria-live="polite" aria-atomic="true"></div>
  </div></div>`;
}

function appFooter():string {
  return `<footer class="app-footer"><p>Review low-priority webhook events in a self-hosted ledger.</p><nav aria-label="Product footer"><a href="${routeUrl('inbox')}" data-route="inbox">Inbox</a><a href="/privacy" data-legal="privacy">Privacy</a><a href="/terms" data-legal="terms">Terms</a><span>Built by Param Factory</span></nav><small>Build ${escapeHtml(BUILD_SHA.slice(0,12))} · Poster artwork generated for Internal Event Ledger.</small></footer>`;
}

function nav(view:View,label:string):string { return `<a class="nav-button ${state.view===view?'active':''}" href="${routeUrl(view)}" data-route="${view}" ${state.view===view?'aria-current="page"':''}>${escapeHtml(label)}</a>`; }

function pageHead(overline:string,title:string,lede:string,extra=''):string {
  return `<div class="page-head"><div><p class="eyebrow">${escapeHtml(overline)}</p><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(lede)}</p></div>${extra}</div>`;
}

function inboxView():string {
  const unread=state.events.filter((e)=>e.status==='unread').length;
  const occurrences=state.events.reduce((n,e)=>n+e.occurrence_count,0);
  const extra=`<div class="stats" aria-label="Ledger totals"><div class="stat"><strong>${unread}</strong><span>Unread</span></div><div class="stat"><strong>${state.events.length}</strong><span>Groups</span></div><div class="stat"><strong>${occurrences}</strong><span>Events</span></div></div>`;
  let body = pageHead('Event review / 01','Event ledger','Low-priority events, grouped for a deliberate review.',extra);
  body += `<div class="toolbar" aria-label="Event filters">
    <div class="field search-field"><label for="search">Search the ledger</label><input id="search" type="search" value="${escapeHtml(state.search)}" placeholder="Summary, type, or payload" autocomplete="off"></div>
    <div class="field"><label for="status-filter">Review state</label><select id="status-filter"><option value="active" ${state.status==='active'?'selected':''}>Active</option><option value="unread" ${state.status==='unread'?'selected':''}>Unread</option><option value="acknowledged" ${state.status==='acknowledged'?'selected':''}>Acknowledged</option><option value="archived" ${state.status==='archived'?'selected':''}>Archived</option><option value="all" ${state.status==='all'?'selected':''}>All events</option></select></div>
    <div class="actions"><button class="button" id="refresh">Refresh</button><button class="button" id="export-csv">Export CSV</button><button class="button" id="export-json">Export JSON</button></div>
  </div>`;
  if(state.loading) return body+`<section class="event-list" role="status" aria-label="Loading events" aria-live="polite" aria-atomic="true"><span class="sr-only">Loading events</span><div class="skeleton" aria-hidden="true"></div><div class="skeleton" aria-hidden="true"></div><div class="skeleton" aria-hidden="true"></div></section>`;
  if(!state.events.length && !state.search && !state.selectedSource) return body+emptyState();
  if(!state.events.length) return body+`<section class="panel"><h2>No matching events</h2><p>Adjust the search or review-state filter. The ledger has not changed.</p><button class="button" id="clear-filters">Clear filters</button></section>`;
  const allSelected=state.events.every((e)=>state.selected.has(e.id));
  body += `<div class="bulk-bar"><label class="check"><input id="select-all" type="checkbox" ${allSelected?'checked':''}><span class="sr-only">Select all visible events</span></label><span>${state.selected.size ? `${state.selected.size} selected` : `${state.events.length} event groups`}</span><div class="actions"><button class="button" id="bulk-ack" ${state.selected.size?'':'disabled'}>Acknowledge</button><button class="button danger" id="bulk-archive" ${state.selected.size?'':'disabled'}>Archive</button></div></div>
    <section class="event-list" aria-label="Event timeline">${state.events.map(eventRow).join('')}</section>`;
  return body;
}

function emptyState():string { return `<section class="empty"><div class="empty-copy"><p class="eyebrow">No events yet</p><h2>Add your first event source.</h2><p>Create a private endpoint, copy its receiver token, and post JSON. The ledger groups matching events by fingerprint.</p><a class="button primary" href="${routeUrl('sources')}" data-route="sources">Add a source</a></div><img src="/assets/dispatch-hall.webp" width="1200" height="800" alt="An illustrated dispatch hall shows several sources converging into one event ledger." decoding="async" fetchpriority="high"></section>`; }

function eventRow(event:EventItem):string {
  const open=state.openEvent===event.id;
  const payload=parseJson<Record<string,unknown>>(event.payload_json,{});
  const headers=parseJson<Record<string,unknown>>(event.headers_json,{});
  return `<article class="event-row" data-status="${event.status}">
    <label class="check"><input type="checkbox" data-select="${event.id}" ${state.selected.has(event.id)?'checked':''}><span class="sr-only">Select ${escapeHtml(event.summary)}</span></label>
    <div class="event-main"><div class="event-line"><span class="event-summary">${escapeHtml(event.summary)}</span><span class="badge ${event.status}">${escapeHtml(event.status)}</span>${event.occurrence_count>1?`<span class="badge">× ${event.occurrence_count}</span>`:''}</div>
      <div class="event-meta"><span>${escapeHtml(event.source_name)} · ${escapeHtml(event.event_type)}</span><time datetime="${escapeHtml(event.last_seen_at)}" title="${escapeHtml(new Date(event.last_seen_at).toLocaleString())}">${relativeTime(event.last_seen_at)}</time><span class="fingerprint">fp ${escapeHtml(event.fingerprint.slice(0,8))}</span></div></div>
    <div class="event-side"><button class="icon-button" data-detail="${event.id}" aria-expanded="${open}" aria-label="${open?'Hide':'Show'} event payload">${open?'−':'{ }'}</button>${event.status!=='acknowledged'?`<button class="button" data-status-id="${event.id}" data-status-value="acknowledged">Acknowledge</button>`:`<button class="button" data-status-id="${event.id}" data-status-value="unread">Reopen</button>`}<button class="icon-button" data-status-id="${event.id}" data-status-value="archived" aria-label="Archive event">⌁</button></div>
    ${open?`<pre class="event-detail" tabindex="0"><strong>PAYLOAD</strong>\n${escapeHtml(JSON.stringify(payload,null,2))}\n\n<strong>KEPT HEADERS</strong>\n${escapeHtml(JSON.stringify(headers,null,2))}</pre>`:''}
  </article>`;
}

function sourcesView():string {
  let body=pageHead('Source setup / 02','Incoming sources','Give each producer a private endpoint, signature policy, and redaction map.');
  if(state.credential) body+=`<section class="credential" role="status"><h2>Copy this token now</h2><p>For security, it will not be shown again. Send it as <code>X-Ledger-Token</code> or a Bearer token.</p><span class="field-label">Receiver URL</span><code>${escapeHtml(location.origin+state.credential.path)}</code><span class="field-label">Token</span><code>${escapeHtml(state.credential.token)}</code><button class="button" id="copy-curl">Copy cURL example</button></section>`;
  body+=`<section class="panel"><div class="panel-head"><div><h2>Registered sources</h2><p>${state.sources.length} sources in service.</p></div></div>${state.sources.length?state.sources.map((s)=>`<div class="source-card"><div><h3><span class="route-code">/${escapeHtml(s.alias)}</span>${escapeHtml(s.name)}</h3><p>${s.event_count} groups · ${s.unread_count} unread · ${s.retention_days} day retention</p><p>Body redactions: ${escapeHtml(parseJson<string[]>(s.redact_paths,[]).join(', ')||'none')}</p></div><div class="actions"><button class="button danger" data-delete-source="${s.id}" data-source-name="${escapeHtml(s.name)}">Remove source</button></div></div>`).join(''):`<p>No sources are registered yet.</p>`}</section>`;
  if(state.demoMode) return body+`<section class="panel demo-note"><h2>Sample sources are read-only</h2><p>Start for real to create private receiver endpoints on this deployment.</p><button class="button primary" data-start-real>Start for real</button></section>`;
  body+=`<section class="panel"><div class="panel-head"><div><h2>Add a source</h2><p>Tokens are generated locally by this server. A signing secret makes HMAC-SHA256 mandatory.</p></div></div>
    <form id="source-form" class="form-grid">
      <div class="field"><label for="source-name">Source name</label><input id="source-name" name="name" required maxlength="80" placeholder="Billing production"></div>
      <div class="field"><label for="source-alias">Endpoint alias</label><input id="source-alias" name="alias" required minlength="2" maxlength="48" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="billing-prod" aria-describedby="alias-help"><p class="form-help" id="alias-help">Lowercase letters, numbers, and hyphens.</p></div>
      <div class="field wide"><label for="signing-secret">HMAC signing secret <span class="form-help">(optional)</span></label><input id="signing-secret" name="signing_secret" type="password" autocomplete="new-password" placeholder="Shared with the sender"><p class="form-help">When set, send a hex digest as <code>X-Ledger-Signature: sha256=…</code>.</p></div>
      <div class="field"><label for="redact-headers">Redact headers</label><input id="redact-headers" name="redact_headers" placeholder="x-api-key, x-customer-email"><p class="form-help">Comma-separated, case-insensitive.</p></div>
      <div class="field"><label for="redact-paths">Redact body paths</label><input id="redact-paths" name="redact_paths" placeholder="user.email, payment.card"><p class="form-help">Dot-separated JSON object paths.</p></div>
      <div class="field"><label for="retention-days">Retention days</label><input id="retention-days" name="retention_days" type="number" min="1" max="3650" value="30"></div>
      <div class="wide actions"><button class="button primary" type="submit">Create endpoint</button></div>
    </form></section>`;
  return body;
}

function digestView():string {
  const windowControl=`<label class="field-label" for="digest-window">Window <select id="digest-window"><option value="6" ${state.digestHours===6?'selected':''}>6 hours</option><option value="12" ${state.digestHours===12?'selected':''}>12 hours</option><option value="24" ${state.digestHours===24?'selected':''}>24 hours</option><option value="72" ${state.digestHours===72?'selected':''}>3 days</option><option value="168" ${state.digestHours===168?'selected':''}>7 days</option></select></label>`;
  const body=pageHead('Event summary / 03','On-demand digest',`A compact roll-up of active events received in the last ${state.digestHours} hours.`,`<div class="actions">${windowControl}<button class="button" id="copy-digest">Copy digest</button><button class="button" id="load-digest">Refresh</button></div>`);
  if(!state.digest) return body+`<div class="panel"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  const d=state.digest;
  return body+`<section class="panel digest-grid"><div><div class="digest-number"><strong>${d.total_occurrences}</strong><span>Events / ${d.hours}h</span></div><p><strong>${d.unread_groups}</strong> unread groups remain.</p><p class="form-help">Generated ${new Date(d.generated_at).toLocaleString()}</p></div><div><h2>Events to review</h2>${d.events.length?`<ol class="digest-list">${d.events.slice(0,30).map((e)=>`<li><strong>${escapeHtml(e.summary)}</strong><br><small>${escapeHtml(e.source_name)} · ${e.occurrence_count} occurrence${e.occurrence_count===1?'':'s'} · ${escapeHtml(e.status)}</small></li>`).join('')}</ol>`:`<p>No active events arrived during this window.</p>`}</div></section>`;
}

function settingsView():string {
  if(state.demoMode) return `${pageHead('Demo controls / 04','Demo settings','This sample cannot change server settings.')}<section class="panel"><h2>Use your own deployment</h2><p>Start for real to manage retention and exports.</p><button class="button primary" data-start-real>Start for real</button></section>`;
  let body=pageHead('Ledger controls / 04','Settings','Manage retention and privacy controls for this ledger.');
  body+=`<section class="panel"><div class="panel-head"><div><h2>Retention</h2><p>Remove event groups that are older than their source retention policy.</p></div></div><div class="actions"><button class="button danger" type="button" id="run-retention">Run retention now</button></div></section>`;
  body+=`<section class="panel"><h2>Privacy controls</h2><p>Events stay in your SQLite database. Receiver credentials are stripped before headers are stored. Export stays available.</p><div class="actions"><button class="button" id="export-json">Export all JSON</button><a class="button" href="/privacy" data-legal="privacy">Read privacy policy</a></div></section>`;
  return body;
}

function legalView(kind:'privacy'|'terms'):string {
  const privacy=`${pageHead('Policy / P','Privacy','How a self-hosted ledger handles operational event data.')}<article class="legal"><p><strong>Effective 30 August 2026.</strong> Internal Event Ledger is self-hosted. Event bodies, selected headers, source configuration, acknowledgment state, and retention preferences are stored only in the SQLite database you operate.</p><h2>What is stored</h2><p>The receiver stores event JSON after configured body-path redaction, selected non-credential headers after header redaction, timestamps, fingerprints, and review state. Authentication tokens, authorization headers, cookies, and webhook signatures are never written into event records.</p><h2>Local operation</h2><p>The application does not contact a billing, analytics, font, CDN, or other third-party service. It reads and writes only its own SQLite database and browser storage used for the sample ledger.</p><h2>Retention and control</h2><p>You choose retention by source, may run deletion at any time, may remove a source and all its events, and can export JSON or CSV. For server access, deletion, or privacy questions, contact the operator of your deployment.</p></article>`;
  const terms=`${pageHead('Policy / T','Terms','Clear conditions for using Internal Event Ledger.')}<article class="legal"><p><strong>Effective 30 August 2026.</strong> You may use and self-host this software under its MIT License. You are responsible for securing the deployment, configuring sender signatures and redaction, and ensuring you have permission to store submitted event data.</p><h2>Scope</h2><p>The product is a review ledger for non-urgent operational events. It is not an incident pager, webhook retry service, backup system, or emergency service. Do not rely on it for life-safety or time-critical alerts.</p><h2>Local data</h2><p>You control the SQLite database and backups for your deployment. The software does not use external billing or identity services.</p><h2>Availability and warranty</h2><p>The software is provided “as is,” without warranty.</p><h2>Fair use</h2><p>Do not use the receiver to collect data unlawfully, interfere with networks, or bypass another system’s access controls.</p></article>`;
  return kind==='privacy'?privacy:terms;
}

function render():void {
  updatePageMetadata();
  if(state.accessRequired && !isPublicLegalView(state.view)) { app.innerHTML=accessView(); bindAccess(); return; }
  let content='';
  if(state.view==='inbox') content=inboxView();
  else if(state.view==='sources') content=sourcesView();
  else if(state.view==='digest') content=digestView();
  else if(state.view==='settings') content=settingsView();
  else content=legalView(state.view);
  app.innerHTML=layout(content);
  bind();
}

function accessView():string {
  return `<div class="landing-shell">
    <header class="landing-header"><a class="brand" href="/" aria-label="Internal Event Ledger home"><span class="brand-mark" aria-hidden="true"><span>IEL</span></span><span class="brand-copy">Internal event<small>Webhook review</small></span></a><nav aria-label="Public pages"><a href="/demo">Demo</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></header>
    <main id="main" tabindex="-1">
      <section class="landing-hero">
        <div class="landing-copy"><p class="eyebrow">Self-hosted webhook review</p><h1>Review low-priority webhook events</h1><p class="landing-lede">For solo developers and small teams who need searchable event history outside Slack.</p><div class="landing-cta"><button class="button primary" id="try-demo">Try it with sample data</button><span>Opens an isolated sample ledger with no token.</span></div><ul class="fact-list"><li>No analytics or third-party scripts.</li><li>Sample events stay readable offline after one visit.</li><li>Free to self-host under the MIT License.</li></ul></div>
        <section class="access-card" aria-labelledby="access-title"><p class="eyebrow">Your deployment</p><h2 id="access-title">Open your ledger</h2><p>Enter the administrator token from your server. It stays in this browser tab.</p>${state.error?`<div class="notice" role="alert">${escapeHtml(state.error)}</div>`:''}<form id="admin-access-form" class="form-grid"><div class="field wide"><label for="admin-token">Administrator token</label><input id="admin-token" name="token" type="password" required autocomplete="current-password" aria-describedby="token-help"><p class="form-help" id="token-help">Find it in the server file shown during setup.</p></div><div class="wide actions"><button class="button" type="submit">Open my ledger</button></div></form></section>
      </section>
      <section class="landing-preview" aria-labelledby="preview-title"><div><p class="eyebrow">Event groups</p><h2 id="preview-title">Group and review repeated webhook events</h2><p>Each source groups matching events by fingerprint. Reviewers can search, acknowledge, archive, and export event groups.</p><ol class="preview-events"><li><strong>Refund review requested</strong><span>Checkout API · 3 events</span></li><li><strong>Catalogue import needs two files</strong><span>Customer imports · 2 events</span></li><li><strong>Production deploy completed</strong><span>Deploy pipeline · acknowledged</span></li></ol></div><img src="/assets/dispatch-hall.webp" width="1200" height="800" alt="An illustrated dispatch hall shows several sources converging into one event ledger." decoding="async" fetchpriority="high"></section>
      <section class="landing-section" aria-labelledby="how-title"><p class="eyebrow">How it works</p><h2 id="how-title">How webhook review works</h2><ol class="step-list"><li><strong>Connect a source.</strong><span>Create a private JSON receiver and optional signature rule.</span></li><li><strong>Review grouped events.</strong><span>Search summaries and payloads outside Slack.</span></li><li><strong>Keep the useful record.</strong><span>Acknowledge, archive, delete by retention, or export.</span></li></ol></section>
      <section class="landing-section boundary" aria-labelledby="boundary-title"><div><p class="eyebrow">Not for urgent alerts</p><h2 id="boundary-title">Use an incident tool for urgent alerts</h2><p>Keep urgent alerts in an incident tool.</p></div><div><p class="eyebrow">Local storage</p><h2>Keep event groups on your server</h2><p>Sources, event groups, settings, and exports stay in this deployment's SQLite database.</p></div></section>
    </main>
    <footer class="landing-footer"><p>Review low-urgency operational events in a self-hosted ledger.</p><nav aria-label="Footer"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>Built by Param Factory</span></nav><small>Build ${escapeHtml(BUILD_SHA.slice(0,12))} · Poster artwork generated for Internal Event Ledger.</small></footer>
  </div>`;
}

function bindAccess():void {
  document.querySelector('#try-demo')?.addEventListener('click',()=>void enterDemo());
  document.querySelector<HTMLFormElement>('#admin-access-form')?.addEventListener('submit',(event)=>{event.preventDefault();const token=String(new FormData(event.currentTarget as HTMLFormElement).get('token')||'').trim();if(!token){state.error='Enter the administrator token.';render();return;}state.adminToken=token;state.accessRequired=false;state.error='';try{sessionStorage.setItem(ADMIN_TOKEN_KEY,token);}catch{/* current-tab access still works */}void refreshAll();render();});
}

function bind():void {
  document.querySelectorAll<HTMLElement>('[data-route]').forEach((el)=>el.addEventListener('click',(event)=>{event.preventDefault();navigate(el.dataset.route as View);}));
  document.querySelectorAll<HTMLElement>('[data-legal]').forEach((el)=>el.addEventListener('click',(event)=>{event.preventDefault();navigate(el.dataset.legal as View);}));
  document.querySelectorAll<HTMLButtonElement>('[data-source]').forEach((el)=>el.addEventListener('click',()=>{state.selectedSource=el.dataset.source||'';if(state.view!=='inbox'){state.view='inbox';history.pushState({},'',routeUrl('inbox'));render();focusHeading();}void loadEvents();}));
  document.querySelector('#retry')?.addEventListener('click',()=>void refreshAll());
  document.querySelector('#refresh')?.addEventListener('click',()=>void loadEvents(true));
  document.querySelector('#export-csv')?.addEventListener('click',()=>void exportEvents('csv'));
  document.querySelector('#export-json')?.addEventListener('click',()=>void exportEvents('json'));
  document.querySelector('#clear-filters')?.addEventListener('click',()=>{state.search='';state.selectedSource='';state.status='active';void loadEvents();});
  let searchTimer=0;
  document.querySelector<HTMLInputElement>('#search')?.addEventListener('input',(event)=>{state.search=(event.target as HTMLInputElement).value;window.clearTimeout(searchTimer);searchTimer=window.setTimeout(()=>void loadEvents(),250);});
  document.querySelector<HTMLSelectElement>('#status-filter')?.addEventListener('change',(event)=>{state.status=(event.target as HTMLSelectElement).value;void loadEvents();});
  document.querySelector('#select-all')?.addEventListener('change',(event)=>{const checked=(event.target as HTMLInputElement).checked;state.events.forEach((e)=>checked?state.selected.add(e.id):state.selected.delete(e.id));render();});
  document.querySelectorAll<HTMLInputElement>('[data-select]').forEach((el)=>el.addEventListener('change',()=>{el.checked?state.selected.add(el.dataset.select!):state.selected.delete(el.dataset.select!);render();}));
  document.querySelectorAll<HTMLButtonElement>('[data-detail]').forEach((el)=>el.addEventListener('click',()=>{state.openEvent=state.openEvent===el.dataset.detail?'':el.dataset.detail!;render();}));
  document.querySelectorAll<HTMLButtonElement>('[data-status-id]').forEach((el)=>el.addEventListener('click',()=>void setStatus([el.dataset.statusId!],el.dataset.statusValue!)));
  document.querySelector('#bulk-ack')?.addEventListener('click',()=>void setStatus([...state.selected],'acknowledged'));
  document.querySelector('#bulk-archive')?.addEventListener('click',()=>{if(confirm(`Archive ${state.selected.size} selected event groups? New events with the same fingerprint will reopen them.`))void setStatus([...state.selected],'archived');});
  const name=document.querySelector<HTMLInputElement>('#source-name'); const alias=document.querySelector<HTMLInputElement>('#source-alias');
  name?.addEventListener('input',()=>{if(alias && (!alias.value || alias.dataset.auto==='true')){alias.value=slugify(name.value);alias.dataset.auto='true';}});
  alias?.addEventListener('input',()=>{alias.dataset.auto='false';});
  document.querySelector<HTMLFormElement>('#source-form')?.addEventListener('submit',(e)=>{e.preventDefault();void createSource(e.currentTarget as HTMLFormElement);});
  document.querySelectorAll<HTMLButtonElement>('[data-delete-source]').forEach((el)=>el.addEventListener('click',()=>{if(confirm(`Remove ${el.dataset.sourceName} and all of its stored events? This cannot be undone.`))void deleteSource(el.dataset.deleteSource!);}));
  document.querySelector('#copy-curl')?.addEventListener('click',()=>void copyCurl());
  document.querySelector('#load-digest')?.addEventListener('click',()=>void loadDigest(true));
  document.querySelector<HTMLSelectElement>('#digest-window')?.addEventListener('change',(event)=>{state.digestHours=Number((event.target as HTMLSelectElement).value);save('ledger:digest-window',String(state.digestHours));void loadDigest(true);});
  document.querySelector('#copy-digest')?.addEventListener('click',()=>void copyDigest());
  document.querySelector<HTMLFormElement>('#settings-form')?.addEventListener('submit',(e)=>{e.preventDefault();void saveSettings(new FormData(e.currentTarget as HTMLFormElement).get('digest_hour') as string);});
  document.querySelector('#run-retention')?.addEventListener('click',()=>void runRetention());
  document.querySelector('#reset-demo')?.addEventListener('click',()=>void resetDemo());
  document.querySelectorAll('[data-start-real]').forEach((element)=>element.addEventListener('click',()=>void startForReal()));
}

function navigate(view:View):void {
  if(state.demoMode&&isPublicLegalView(view))discardDemo();
  state.view=view; state.error='';
  if(isPublicLegalView(view)){state.demoMode=false;state.accessRequired=!state.adminToken;}
  history.pushState({},'',routeUrl(view)); render();
  focusHeading();
  if(view==='digest'&&!state.digest)void loadDigest().then(focusHeading);
}

async function refreshAll():Promise<void>{ if(state.demoMode){await loadEvents();return;}state.error='';await Promise.all([loadSources(false),loadEvents(false),loadSettings(false)]);render(); }

async function loadSources(show=true):Promise<void>{ if(state.demoMode){if(show)render();return;}try{const data=await api<{sources:Source[]}>('/api/sources');state.sources=data.sources;}catch(error){state.error=messageFor(error);}if(show)render(); }

async function loadEvents(showLoading=false):Promise<void>{
  if(showLoading){state.loading=true;render();}
  if(state.demoMode){const search=state.search.trim().toLowerCase();state.events=state.demoEvents.filter((event)=>{const sourceMatches=!state.selectedSource||event.source_id===state.selectedSource;const statusMatches=state.status==='all'||(state.status==='active'?event.status!=='archived':event.status===state.status);const searchMatches=!search||`${event.summary} ${event.event_type} ${event.payload_json}`.toLowerCase().includes(search);return sourceMatches&&statusMatches&&searchMatches;});state.loading=false;state.error='';render();return;}
  try{const params=new URLSearchParams();if(state.search)params.set('q',state.search);if(state.selectedSource)params.set('source',state.selectedSource);if(state.status!=='all'&&state.status!=='active')params.set('status',state.status);state.error='';const data=await api<{events:EventItem[]}>(`/api/events?${params}`);state.events=state.status==='active'?data.events.filter((e)=>e.status!=='archived'):data.events;state.selected=new Set([...state.selected].filter((id)=>state.events.some((e)=>e.id===id)));}catch(error){state.error=state.online?messageFor(error):'You are offline. Reconnect to refresh the ledger.';}state.loading=false;render();
}

async function setStatus(ids:string[],status:string):Promise<void>{
  if(state.demoMode){state.demoEvents=state.demoEvents.map((event)=>ids.includes(event.id)?{...event,status:status as EventItem['status']}:event);state.selected.clear();refreshDemoSourceCounts();toast(status==='acknowledged'?'Marked as acknowledged.':'Sample ledger state updated.');await loadEvents();persistDemo();return;}
  try{if(ids.length===1)await api(`/api/events/${ids[0]}`,{method:'PATCH',body:JSON.stringify({status})});else await api('/api/events',{method:'PATCH',body:JSON.stringify({ids,status})});state.events=state.events.map((e)=>ids.includes(e.id)?{...e,status:status as EventItem['status']}:e);if(state.status==='active'&&status==='archived')state.events=state.events.filter((e)=>!ids.includes(e.id));state.selected.clear();toast(status==='acknowledged'?'Marked as acknowledged.':'Ledger state updated.');render();void loadSources(false);}catch(error){state.error=messageFor(error);render();}
}

async function createSource(form:HTMLFormElement):Promise<void>{
  const submit=form.querySelector<HTMLButtonElement>('button[type=submit]')!;submit.disabled=true;submit.textContent='Creating…';const fd=new FormData(form);
  const payload={name:fd.get('name'),alias:fd.get('alias'),signing_secret:fd.get('signing_secret')||null,redact_headers:String(fd.get('redact_headers')||'').split(',').map((v)=>v.trim()).filter(Boolean),redact_paths:String(fd.get('redact_paths')||'').split(',').map((v)=>v.trim()).filter(Boolean),retention_days:Number(fd.get('retention_days'))};
  try{const data=await api<{alias:string;token:string;ingest_path:string}>('/api/sources',{method:'POST',body:JSON.stringify(payload)});state.credential={alias:data.alias,token:data.token,path:data.ingest_path};await loadSources(false);render();toast('Endpoint created. Copy its token now.');}catch(error){state.error=messageFor(error);render();}
}

async function deleteSource(id:string):Promise<void>{try{await api(`/api/sources/${id}`,{method:'DELETE'});state.credential=null;await Promise.all([loadSources(false),loadEvents(false)]);toast('Source and its events were removed.');}catch(error){state.error=messageFor(error);render();}}

async function copyCurl():Promise<void>{if(!state.credential)return;const command=`curl -X POST '${location.origin}${state.credential.path}' -H 'Content-Type: application/json' -H 'X-Ledger-Token: ${state.credential.token}' -d '{"type":"deploy.completed","summary":"Production deploy completed","version":"1.0.0"}'`;try{await navigator.clipboard.writeText(command);toast('cURL example copied.');}catch{state.error='Clipboard access was blocked. Select and copy the receiver URL and token above.';render();}}

async function loadDigest(show=false):Promise<void>{if(show){state.digest=null;render();}if(state.demoMode){const events=state.demoEvents.filter((event)=>event.status!=='archived');state.digest={hours:24,generated_at:new Date().toISOString(),total_occurrences:events.reduce((total,event)=>total+event.occurrence_count,0),unread_groups:events.filter((event)=>event.status==='unread').length,events};render();return;}try{state.digest=await api<Digest>(`/api/digest?hours=${state.digestHours}`);}catch(error){state.error=messageFor(error);}render();}

async function copyDigest():Promise<void>{if(!state.digest)return;const lines=[`Internal Event Ledger — ${state.digest.total_occurrences} events / ${state.digest.hours}h`,`${state.digest.unread_groups} unread groups`,...state.digest.events.map((e)=>`• ${e.summary} — ${e.source_name} ×${e.occurrence_count} [${e.status}]`)];try{await navigator.clipboard.writeText(lines.join('\n'));toast('Digest copied.');}catch{state.error='Clipboard access was blocked by the browser.';render();}}

async function loadSettings(show=true):Promise<void>{if(state.demoMode){if(show)render();return;}try{const data=await api<{digest_hour:string}>('/api/settings');state.digestHour=data.digest_hour;}catch(error){state.error=messageFor(error);}if(show)render();}
async function saveSettings(value:string):Promise<void>{try{const data=await api<{digest_hour:string}>('/api/settings',{method:'PUT',body:JSON.stringify({digest_hour:value})});state.digestHour=data.digest_hour;toast('Daily review time saved.');}catch(error){state.error=messageFor(error);}render();}
async function runRetention():Promise<void>{if(!confirm('Delete events older than each source retention policy? This cannot be undone.'))return;try{const data=await api<{deleted:number}>('/api/maintenance/retention',{method:'POST',body:'{}'});toast(`${data.deleted} expired event${data.deleted===1?'':'s'} deleted.`);await loadEvents(false);}catch(error){state.error=messageFor(error);render();}}

async function exportEvents(format:'csv'|'json'):Promise<void>{try{if(state.demoMode){const body=format==='json'?JSON.stringify(state.demoEvents,null,2):demoCsv(state.demoEvents);downloadBlob(new Blob([body],{type:format==='json'?'application/json':'text/csv;charset=utf-8'}),`event-ledger-demo.${format}`);toast(`Exported sample ${format.toUpperCase()}.`);return;}const response=await fetch(`/api/export?format=${format}`,{headers:{authorization:`Bearer ${state.adminToken}`}});if(!response.ok)throw new ApiRequestError(response.status,'Could not export the ledger.');downloadBlob(await response.blob(),`event-ledger.${format}`);toast(`Exported ${format.toUpperCase()}.`);}catch(error){state.error=messageFor(error);render();}}

function downloadBlob(blob:Blob,name:string):void{const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);}
function csvCell(value:unknown):string{return `"${String(value??'').replaceAll('"','""')}"`;}
function demoCsv(events:EventItem[]):string{return ['id,source,type,summary,status,occurrences,first_seen,last_seen,fingerprint',...events.map((event)=>[event.id,event.source_name,event.event_type,event.summary,event.status,event.occurrence_count,event.received_at,event.last_seen_at,event.fingerprint].map(csvCell).join(','))].join('\n')+'\n';}

async function enterDemo():Promise<void>{history.pushState({},'','/demo');state.demoMode=true;state.accessRequired=false;state.view='inbox';state.error='';state.loading=true;render();await provisionDemo();focusHeading();}
async function resetDemo():Promise<void>{const previous=state.demoId;removeStoredDemo();state.loading=true;state.error='';render();if(previous)void fetch(`/api/demo/${encodeURIComponent(previous)}`,{method:'DELETE'});await provisionDemo();toast('The sample workspace was reset.');}
async function startForReal():Promise<void>{discardDemo();state.demoMode=false;state.accessRequired=!state.adminToken;history.pushState({},'','/');if(state.accessRequired){render();focusHeading();return;}await refreshAll();focusHeading();}

async function provisionDemo():Promise<void>{
  try{const response=await fetch('/api/demo',{method:'POST'});if(!response.ok)throw new Error('The sample workspace could not be created. Try again.');applyDemo(await response.json() as DemoWorkspace,Date.now());persistDemo();await loadEvents();}
  catch(error){state.loading=false;state.error=state.online?(error as Error).message:'The sample is not cached yet. Reconnect once to load it.';render();}
}

function applyDemo(workspace:DemoWorkspace,startedAt:number):void{state.demoId=workspace.workspace_id;state.demoStartedAt=startedAt;state.sources=workspace.sources;state.demoEvents=workspace.events;state.digestHour=workspace.digest_hour;state.loading=false;state.error='';refreshDemoSourceCounts();}
function refreshDemoSourceCounts():void{state.sources=state.sources.map((source)=>{const events=state.demoEvents.filter((event)=>event.source_id===source.id);return {...source,event_count:events.length,unread_count:events.filter((event)=>event.status==='unread').length};});}
function persistDemo():void{try{localStorage.setItem(DEMO_KEY,JSON.stringify({saved_at:state.demoStartedAt,workspace:{workspace_id:state.demoId,expires_in_seconds:86400,digest_hour:state.digestHour,sources:state.sources,events:state.demoEvents}}));}catch{/* the online demo still works when browser storage is unavailable */}}
function removeStoredDemo():void{try{localStorage.removeItem(DEMO_KEY);}catch{/* the in-memory sample can still be discarded */}}
function cachedDemoId():string{try{return (JSON.parse(localStorage.getItem(DEMO_KEY)||'null') as {workspace?:DemoWorkspace}|null)?.workspace?.workspace_id||'';}catch{return '';}}
function discardDemo():void{const previous=state.demoId||cachedDemoId();if(previous)void fetch(`/api/demo/${encodeURIComponent(previous)}`,{method:'DELETE',keepalive:true});removeStoredDemo();state.demoId='';state.demoStartedAt=0;state.demoEvents=[];state.sources=[];state.events=[];state.digest=null;state.search='';state.selectedSource='';state.status='active';state.openEvent='';state.selected.clear();state.loading=false;}
function restoreCachedDemo():boolean{try{const cached=JSON.parse(localStorage.getItem(DEMO_KEY)||'null') as null|{saved_at:number;workspace:DemoWorkspace};if(!cached||Date.now()-cached.saved_at>=86_400_000){removeStoredDemo();return false;}applyDemo(cached.workspace,cached.saved_at);return true;}catch{removeStoredDemo();return false;}}

function focusHeading():void{
  const heading=document.querySelector<HTMLElement>('h1');
  if(!heading)return;
  heading.tabIndex=-1;
  heading.focus();
  const announcer=document.querySelector<HTMLElement>('#route-announcer');
  if(announcer)announcer.textContent=heading.textContent||'';
}

function updatePageMetadata():void{
  const demoTitle=state.view==='inbox'?'Demo — Internal Event Ledger':`Demo ${state.view[0].toUpperCase()+state.view.slice(1)} — Internal Event Ledger`;
  const title=state.demoMode?demoTitle:state.view==='privacy'?'Privacy — Internal Event Ledger':state.view==='terms'?'Terms — Internal Event Ledger':state.accessRequired?'Internal Event Ledger — review webhook events':`${state.view[0].toUpperCase()+state.view.slice(1)} — Internal Event Ledger`;
  document.title=title;
  const canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(canonical)canonical.href=`${location.origin}${state.demoMode||isPublicLegalView(state.view)?routeUrl(state.view):state.accessRequired?'/':'/'+state.view}`;
}

function toast(message:string):void{const region=document.querySelector('.toast-region');if(!region)return;const node=document.createElement('div');node.className='toast';node.textContent=message;region.append(node);setTimeout(()=>node.remove(),3600);}

function stored(key:string):string|null{try{return localStorage.getItem(key);}catch{return null;}}
function save(key:string,value:string):void{try{localStorage.setItem(key,value);}catch{/* private mode: free app remains usable */}}

window.addEventListener('popstate',()=>{
  const nextDemoMode=isDemoRoute();
  if(state.demoMode&&!nextDemoMode)discardDemo();
  state.view=routeView();state.demoMode=nextDemoMode;state.accessRequired=!state.demoMode&&!state.adminToken;
  if(state.demoMode&&!state.demoId){const restored=restoreCachedDemo();state.loading=!restored;render();if(restored)void loadEvents();else if(state.online)void provisionDemo();else{state.loading=false;state.error='The sample is not cached yet. Reconnect once to load it.';render();}}else{render();if(state.view==='digest'&&!state.digest)void loadDigest().then(focusHeading);}
  focusHeading();
});
window.addEventListener('online',()=>{state.online=true;if(state.demoMode&&!state.demoId)void provisionDemo();else void refreshAll();});
window.addEventListener('offline',()=>{state.online=false;render();});

async function start():Promise<void>{
  if('serviceWorker' in navigator)registerServiceWorker();
  if(startsInDemo){if(new URLSearchParams(location.search).get('demo')==='1')history.replaceState({},'','/demo');state.view=routeView();state.demoMode=true;state.accessRequired=false;const restored=restoreCachedDemo();render();if(!restored){if(state.online)await provisionDemo();else{state.loading=false;state.error='The sample is not cached yet. Reconnect once to load it.';render();}}else await loadEvents();if(state.view==='digest')await loadDigest();return;}
  // Any non-demo route is an explicit exit from the sandbox, including a
  // direct address-bar visit or a normal browser navigation to a legal page.
  discardDemo();
  render();
  if(state.accessRequired)return;
  if(!state.online){state.loading=false;state.error='You are offline. Reconnect to refresh the ledger.';render();return;}
  state.digestHours=Math.min(168,Math.max(1,Number(stored('ledger:digest-window'))||24));
  await refreshAll();
  if(state.view==='digest')await loadDigest();else render();
}

function registerServiceWorker():void{let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload();}});navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(BUILD_SHA)}`).catch(()=>{});}

void start();
