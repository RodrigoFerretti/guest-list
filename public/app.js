// Lista de convidados v2: frontend sem framework. Fala com /api/* enviando usuário e
// senha no cabeçalho Authorization (HTTP Basic). O papel (admin ou porta) vem do servidor.

const AUTH_KEY = 'guestListAuth';
const REFRESH_MS = 15000;

const I18N = {
  'pt-BR': {
    'login.hint': 'Entre com o usuário e a senha que você recebeu.',
    'login.placeholder': 'Senha',
    'login.enter': 'Entrar',
    'login.host': 'Porta',
    'login.admin': 'Organizador',
    'login.invalid': 'Usuário ou senha incorretos.',
    search: 'Buscar convidados...',
    loading: 'Carregando convidados...',
    cancel: 'Cancelar',
    close: 'Fechar',
    'add.title': 'Adicionar convidado',
    'add.placeholder': 'Nome do convidado',
    'add.confirm': 'Adicionar',
    'add.empty': 'Digite o nome do convidado.',
    'add.duplicate': 'Convidado já existe.',
    'menu.title': 'Organizador',
    'menu.stats': 'Estatísticas',
    'menu.import': 'Importar nomes',
    'menu.export': 'Exportar CSV',
    'menu.logout': 'Sair deste aparelho',
    'stats.title': 'Estatísticas',
    'stats.total': 'convidados',
    'stats.present': 'presentes',
    'stats.absent': 'faltam',
    'stats.byHour': 'Chegadas por hora',
    'stats.none': 'Nenhuma chegada registrada ainda.',
    'import.title': 'Importar nomes',
    'import.hint': 'Um nome por linha. Nomes repetidos são ignorados.',
    'import.confirm': 'Importar',
    'import.result': (r) => `${r.added} adicionado(s), ${r.skipped} já existia(m).`,
    counter: (p, t) => `${p} de ${t} presentes`,
    empty: 'Nenhum convidado encontrado',
    loadError: 'Erro ao carregar. Verifique sua conexão.',
    updateError: 'Erro ao atualizar. Tente novamente.',
    present: 'Presente',
    arrivedAt: (t) => `Chegou às ${t}`,
    notArrived: 'Não chegou',
    confirm: 'Confirmar presença',
    undo: 'Remover presença',
    remove: 'Remover da lista',
    removeArmed: 'Toque de novo para remover',
    removed: 'Convidado removido.',
    roleAdmin: 'admin',
    roleHost: 'porta',
    forbidden: 'Apenas o administrador pode fazer isso.',
  },
  en: {
    'login.hint': 'Sign in with the user and password you received.',
    'login.placeholder': 'Password',
    'login.enter': 'Enter',
    'login.host': 'Door',
    'login.admin': 'Organizer',
    'login.invalid': 'Wrong user or password.',
    search: 'Search guests...',
    loading: 'Loading guests...',
    cancel: 'Cancel',
    close: 'Close',
    'add.title': 'Add guest',
    'add.placeholder': 'Guest name',
    'add.confirm': 'Add',
    'add.empty': 'Type the guest name.',
    'add.duplicate': 'Guest already exists.',
    'menu.title': 'Organizer',
    'menu.stats': 'Statistics',
    'menu.import': 'Import names',
    'menu.export': 'Export CSV',
    'menu.logout': 'Sign out on this device',
    'stats.title': 'Statistics',
    'stats.total': 'guests',
    'stats.present': 'present',
    'stats.absent': 'missing',
    'stats.byHour': 'Arrivals per hour',
    'stats.none': 'No arrivals yet.',
    'import.title': 'Import names',
    'import.hint': 'One name per line. Duplicates are ignored.',
    'import.confirm': 'Import',
    'import.result': (r) => `${r.added} added, ${r.skipped} already existed.`,
    counter: (p, t) => `${p} of ${t} present`,
    empty: 'No guests found',
    loadError: 'Could not load. Check your connection.',
    updateError: 'Could not update. Try again.',
    present: 'Present',
    arrivedAt: (t) => `Arrived at ${t}`,
    notArrived: 'Not arrived',
    confirm: 'Confirm arrival',
    undo: 'Undo arrival',
    remove: 'Remove from list',
    removeArmed: 'Tap again to remove',
    removed: 'Guest removed.',
    roleAdmin: 'admin',
    roleHost: 'door',
    forbidden: 'Only the administrator can do that.',
  },
};

let lang = 'pt-BR';
const t = (key, ...args) => {
  const value = (I18N[lang] || I18N['pt-BR'])[key] ?? I18N['pt-BR'][key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
};

const $ = (id) => document.getElementById(id);
let auth = '';        // base64(user:senha), só em memória e no localStorage deste aparelho
let role = null;
let guests = [];
let selectedId = null;
let refreshTimer = null;

// ---------- utilidades ----------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function timeOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}
let toastTimer = null;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
function show(id) { $(id).classList.add('active'); }
function hide(id) { $(id).classList.remove('active'); }

function applyI18n() {
  document.documentElement.lang = lang.toLowerCase();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}

// ---------- API ----------
class ApiError extends Error {
  constructor(status, body) { super(body?.message || body?.error || `HTTP ${status}`); this.status = status; this.code = body?.error; }
}
async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { Authorization: `Basic ${auth}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401) { logout(true); throw new ApiError(401, { error: 'unauthorized' }); }
  if (raw) { if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({}))); return res; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// ---------- sessão ----------
let selectedUser = 'porta';
function logout(expired = false) {
  auth = '';
  role = null;
  try { localStorage.removeItem(AUTH_KEY); } catch {}
  clearInterval(refreshTimer);
  ['modal', 'add-modal', 'menu-modal', 'stats-modal', 'import-modal'].forEach(hide);
  $('login-overlay').classList.remove('hidden');
  $('password-input').value = '';
  if (expired) toast(t('login.invalid'));
}
async function login(candidate) {
  auth = candidate;
  if (!auth) return;
  try {
    const me = await api('/api/me');
    role = me.role;
  } catch (err) {
    if (err.status !== 401) toast(t('loadError'));
    return;
  }
  try { localStorage.setItem(AUTH_KEY, auth); } catch {}
  $('login-overlay').classList.add('hidden');
  $('role-badge').textContent = role === 'admin' ? t('roleAdmin') : t('roleHost');
  $('role-badge').className = `role-badge ${role}`;
  $('add-btn').classList.toggle('hidden', role !== 'admin');
  $('menu-btn').classList.toggle('hidden', role !== 'admin');
  await loadGuests();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => { if (!document.hidden) loadGuests(true); }, REFRESH_MS);
}
function loginFromForm() {
  const password = $('password-input').value;
  if (!password) return;
  // btoa com UTF-8: senhas com acento também funcionam
  const raw = `${selectedUser}:${password}`;
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(raw)));
  login(b64);
}

// ---------- lista ----------
async function loadGuests(silent = false) {
  try {
    const data = await api('/api/guests');
    guests = data.guests;
    renderGuests();
  } catch (err) {
    if (err.status === 401) return;
    if (!silent) $('guest-list').innerHTML = `<li class="error">${t('loadError')}</li>`;
  }
}
function renderGuests() {
  const listEl = $('guest-list');
  const term = $('search').value.toLowerCase();
  const filtered = guests
    .filter((g) => g.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
  const presentCount = guests.filter((g) => g.present).length;
  $('stats-text').textContent = t('counter', presentCount, guests.length);
  if (filtered.length === 0) { listEl.innerHTML = `<li class="empty">${t('empty')}</li>`; return; }
  listEl.innerHTML = filtered.map((g) => `
    <li class="guest-item ${g.present ? 'present' : ''}" data-id="${g.id}">
      <span class="guest-name">${escapeHtml(g.name)}</span>
      ${g.present ? `<span class="guest-time">${timeOf(g.present_changed_at)}</span>` : ''}
      <span class="guest-status">${g.present ? '✓' : ''}</span>
    </li>`).join('');
}

// ---------- modal do convidado ----------
function openModal(id) {
  const guest = guests.find((g) => g.id === id);
  if (!guest) return;
  selectedId = id;
  $('modal-name').textContent = guest.name;
  $('modal-status').textContent = guest.present ? t('arrivedAt', timeOf(guest.present_changed_at)) : t('notArrived');
  const action = $('modal-action');
  action.textContent = guest.present ? t('undo') : t('confirm');
  action.className = `modal-btn ${guest.present ? 'modal-btn-remove' : 'modal-btn-confirm'}`;
  const remove = $('modal-remove');
  remove.classList.toggle('hidden', role !== 'admin');
  remove.classList.remove('armed');
  remove.textContent = t('remove');
  show('modal');
}
function closeModal() { hide('modal'); selectedId = null; }

async function togglePresence(id) {
  const guest = guests.find((g) => g.id === id);
  if (!guest) return;
  const previous = { present: guest.present, at: guest.present_changed_at };
  guest.present = guest.present ? 0 : 1;             // atualização otimista
  guest.present_changed_at = new Date().toISOString();
  renderGuests();
  try {
    const { guest: updated } = await api(`/api/guests/${id}/presence`, { method: 'POST', body: { present: !!guest.present } });
    Object.assign(guest, updated);                     // reconcilia com o servidor
    renderGuests();
  } catch (err) {
    guest.present = previous.present;
    guest.present_changed_at = previous.at;
    renderGuests();
    if (err.status === 404) loadGuests(); else if (err.status !== 401) toast(t('updateError'));
  }
}

async function removeGuest(id) {
  try {
    await api(`/api/guests/${id}`, { method: 'DELETE' });
    guests = guests.filter((g) => g.id !== id);
    renderGuests();
    toast(t('removed'));
  } catch (err) {
    if (err.status !== 401) toast(err.status === 403 ? t('forbidden') : t('updateError'));
  }
}

async function addGuest() {
  const input = $('new-guest-name');
  const name = input.value.trim();
  if (!name) { toast(t('add.empty')); return; }
  hide('add-modal');
  try {
    const { guest } = await api('/api/guests', { method: 'POST', body: { name } });
    guests.push(guest);
    renderGuests();
  } catch (err) {
    if (err.code === 'duplicate') toast(t('add.duplicate'));
    else if (err.status === 403) toast(t('forbidden'));
    else if (err.status !== 401) toast(t('updateError'));
  }
}

// ---------- admin ----------
async function openStats() {
  hide('menu-modal');
  const body = $('stats-body');
  body.innerHTML = `<p class="modal-status">${t('loading')}</p>`;
  show('stats-modal');
  try {
    const s = await api('/api/stats');
    const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
    const buckets = new Map();
    for (const c of s.checkins) {
      if (!c.present) continue;
      const d = new Date(c.changed_at);
      const key = `${String(d.getHours()).padStart(2, '0')}:00`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const max = Math.max(1, ...buckets.values());
    const rows = [...buckets.entries()].sort().map(([h, n]) =>
      `<div class="bar-row"><span class="bar-label">${h}</span><span class="bar" style="width:${Math.round((n / max) * 160)}px"></span><span class="bar-value">${n}</span></div>`).join('');
    body.innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><b>${s.total}</b><span>${t('stats.total')}</span></div>
        <div class="stat-box"><b>${s.present}</b><span>${t('stats.present')} (${pct}%)</span></div>
        <div class="stat-box"><b>${s.absent}</b><span>${t('stats.absent')}</span></div>
      </div>
      <div class="bars"><b>${t('stats.byHour')}</b>${rows || `<p>${t('stats.none')}</p>`}</div>`;
  } catch (err) {
    body.innerHTML = `<p class="error">${t('loadError')}</p>`;
  }
}

async function importNames() {
  const names = $('import-text').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return;
  $('import-confirm').disabled = true;
  try {
    let added = 0, skipped = 0;
    for (let i = 0; i < names.length; i += 500) {
      const r = await api('/api/import', { method: 'POST', body: { names: names.slice(i, i + 500) } });
      added += r.added; skipped += r.skipped;
    }
    hide('import-modal');
    $('import-text').value = '';
    toast(t('import.result', { added, skipped }));
    await loadGuests();
  } catch (err) {
    if (err.status !== 401) toast(t('updateError'));
  } finally {
    $('import-confirm').disabled = false;
  }
}

async function exportCsv() {
  hide('menu-modal');
  try {
    const res = await api('/api/export', { raw: true });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `convidados-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (err) {
    if (err.status !== 401) toast(t('loadError'));
  }
}

// ---------- eventos ----------
$('login-btn').addEventListener('click', loginFromForm);
$('password-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') loginFromForm(); });
$('user-select').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  selectedUser = btn.dataset.user;
  document.querySelectorAll('#user-select .seg').forEach((b) => b.classList.toggle('active', b === btn));
});
$('search').addEventListener('input', renderGuests);
$('guest-list').addEventListener('click', (e) => {
  const item = e.target.closest('.guest-item');
  if (item) openModal(Number(item.dataset.id));
});
$('modal-action').addEventListener('click', () => { if (selectedId !== null) { togglePresence(selectedId); closeModal(); } });
$('modal-remove').addEventListener('click', () => {
  const btn = $('modal-remove');
  if (!btn.classList.contains('armed')) { btn.classList.add('armed'); btn.textContent = t('removeArmed'); return; }
  const id = selectedId;
  closeModal();
  removeGuest(id);
});
$('modal-cancel').addEventListener('click', closeModal);
$('add-btn').addEventListener('click', () => { $('new-guest-name').value = ''; show('add-modal'); $('new-guest-name').focus(); });
$('add-guest-cancel').addEventListener('click', () => hide('add-modal'));
$('add-guest-confirm').addEventListener('click', addGuest);
$('new-guest-name').addEventListener('keypress', (e) => { if (e.key === 'Enter') addGuest(); });
$('menu-btn').addEventListener('click', () => show('menu-modal'));
$('menu-cancel').addEventListener('click', () => hide('menu-modal'));
$('menu-stats').addEventListener('click', openStats);
$('stats-close').addEventListener('click', () => hide('stats-modal'));
$('menu-import').addEventListener('click', () => { hide('menu-modal'); show('import-modal'); $('import-text').focus(); });
$('import-cancel').addEventListener('click', () => hide('import-modal'));
$('import-confirm').addEventListener('click', importNames);
$('menu-export').addEventListener('click', exportCsv);
$('menu-logout').addEventListener('click', () => logout());
document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hide(overlay.id); });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && auth) loadGuests(true); });

// ---------- início ----------
(async function start() {
  try {
    const cfg = await fetch('/api/config').then((r) => r.json());
    lang = I18N[cfg.language] ? cfg.language : 'pt-BR';
    $('title').textContent = cfg.title;
    $('login-title').textContent = cfg.title;
    document.title = cfg.title;
  } catch { /* mantém os textos padrão */ }
  applyI18n();
  let stored = '';
  try { stored = localStorage.getItem(AUTH_KEY) || ''; } catch {}
  if (stored) await login(stored);
})();
