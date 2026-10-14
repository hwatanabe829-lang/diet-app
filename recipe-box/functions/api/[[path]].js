// Cloudflare Pages Functions + D1. All personal recipe queries are scoped to the authenticated user.
// No external dependencies; never stores plaintext passwords, session tokens, or original screenshots.
const COOKIE = 'recipebox_session';
const DAYS = 14 * 86400;
const encoder = new TextEncoder();
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const respond = (data, status = 200, cookie = '') => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...(cookie ? { 'set-cookie': cookie } : {}) } });
const fail = (message, status = 400) => respond({ error: message }, status);
const hex = arr => Array.from(new Uint8Array(arr), b => b.toString(16).padStart(2, '0')).join('');
const random = len => hex(crypto.getRandomValues(new Uint8Array(len)));
const hashToken = async token => hex(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
const sessionCookie = (token, age = DAYS) => `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const getCookie = request => (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
const validName = n => /^[a-z0-9][a-z0-9_-]{2,29}$/.test(n);
const passwordOkay = p => typeof p === 'string' && p.length >= 12 && p.length <= 128;

async function derivePassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt.match(/.{2}/g), x => parseInt(x, 16)), iterations: 210000, hash: 'SHA-256' }, key, 256);
  return hex(bytes);
}
function equalHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let v = 0; for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i); return v === 0;
}
async function ensureTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS recipes (owner_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, shared INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id, id), FOREIGN KEY(owner_id) REFERENCES users(id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS recipes_shared_idx ON recipes(shared, updated_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (username TEXT NOT NULL, bucket INTEGER NOT NULL, failures INTEGER NOT NULL, PRIMARY KEY(username, bucket))`)
  ]);
}
async function readJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('JSONを送信してください');
  const content = await request.text();
  if (content.length > 300000) throw new Error('データが大きすぎます');
  try { return JSON.parse(content); } catch { throw new Error('JSONの形式が正しくありません'); }
}
async function auth(db, request) {
  const raw = getCookie(request);
  if (!/^[0-9a-f]{64}$/.test(raw)) return null;
  const h = await hashToken(raw);
  return await db.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(h, Math.floor(Date.now() / 1000)).first();
}
async function newSession(db, user) {
  const token = random(32);
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hashToken(token), user.id, Math.floor(Date.now() / 1000) + DAYS).run();
  return respond({ user: { id: user.id, username: user.username } }, 200, sessionCookie(token));
}
const str = (v, max = 4000) => String(v ?? '').slice(0, max);
function normalizeRecipe(input, id) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('レシピを確認してください');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('不正なレシピID');
  const title = str(input.title, 120).trim();
  if (!title) throw new Error('レシピ名が必要です');
  const cover = str(input.cover, 2000);
  // Only licensed Commons reference links sync. User photos and SNS screenshots remain on that user's device.
  const allowCover = /^https:\/\/(?:upload\.wikimedia\.org|commons\.wikimedia\.org)\//i.test(cover);
  return {
    id, title, ingredients: str(input.ingredients, 8000), steps: str(input.steps, 15000), nutrition: str(input.nutrition, 2000),
    category: str(input.category, 40), notes: str(input.notes, 4000),
    source: /^https:\/\//i.test(str(input.source, 1024)) ? str(input.source, 1024) : '',
    cover: allowCover ? cover : '', coverType: allowCover ? 'commons' : '',
    coverAttribution: allowCover ? str(input.coverAttribution, 1000) : '', coverInfo: null,
    rawText: '', originalName: '', searchTerm: str(input.searchTerm, 100),
    createdAt: str(input.createdAt, 40) || new Date().toISOString(),
    updatedAt: new Date().toISOString(), favorite: Boolean(input.favorite), shared: Boolean(input.shared)
  };
}
function shareSafe(recipe, owner) {
  // No personal notes, screenshots, original filename, source URL, photos, or OCR rawText leak to other users.
  return { owner, id: recipe.id, title: recipe.title, category: recipe.category,
    ingredients: recipe.ingredients, steps: recipe.steps, nutrition: recipe.nutrition };
}
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return request.headers.get('sec-fetch-site') !== 'cross-site';
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return fail('データベースが接続されていません。管理者にお問い合わせください。', 503);
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && !sameOrigin(request)) return fail('このサイトから操作してください', 403);
  try {
    await ensureTables(db);
    const path = new URL(request.url).pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
    const method = request.method;
    if (path === 'health' && method === 'GET') return respond({ ok: true, database: true });
    if (path === 'auth/register' && method === 'POST') {
      const body = await readJson(request);
      const username = str(body?.username, 100).toLowerCase().trim();
      if (!validName(username)) return fail('IDは英小文字・数字・_・-を使い、3〜30文字で設定してください');
      if (!passwordOkay(body?.password)) return fail('パスワードは12〜128文字で設定してください');
      const salt = random(16); const id = crypto.randomUUID();
      const hash = await derivePassword(body.password, salt);
      try { await db.prepare('INSERT INTO users(id,username,salt,password_hash,created_at) VALUES(?,?,?,?,?)').bind(id,username,salt,hash,new Date().toISOString()).run(); }
      catch (e) { if (/UNIQUE|constraint/i.test(String(e))) return fail('このIDは使用されています', 409); throw e; }
      return newSession(db,{ id,username });
    }
    if (path === 'auth/login' && method === 'POST') {
      const body = await readJson(request);
      const username = str(body?.username, 100).toLowerCase().trim();
      const password = body?.password;
      if (!validName(username) || typeof password !== 'string' || password.length > 128) return fail('IDまたはパスワードが違います', 401);
      const bucket = Math.floor(Date.now() / 900000);
      const attempts = await db.prepare('SELECT failures FROM login_attempts WHERE username=? AND bucket=?').bind(username,bucket).first();
      if (attempts && attempts.failures >= 8) return fail('ログイン試行が多すぎます。15分ほど後にお試しください', 429);
      const user = await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
      const compare = await derivePassword(password, user?.salt || '00000000000000000000000000000000');
      if (!user || !equalHash(compare, user.password_hash)) {
        await db.prepare('INSERT INTO login_attempts(username,bucket,failures) VALUES(?,?,1) ON CONFLICT(username,bucket) DO UPDATE SET failures=failures+1').bind(username,bucket).run();
        return fail('IDまたはパスワードが違います',401);
      }
      await db.prepare('DELETE FROM login_attempts WHERE username=?').bind(username).run();
      return newSession(db,user);
    }
    const user = await auth(db,request);
    if (path === 'auth/me' && method === 'GET') return user ? respond({user}) : fail('ログインしてください',401);
    if (path === 'auth/logout' && method === 'POST') {
      const raw = getCookie(request);
      if (raw) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hashToken(raw)).run();
      return respond({ok:true},200,sessionCookie('',0));
    }
    if (!user) return fail('ログインしてください',401);
    if (path === 'recipes' && method === 'GET') {
      const res = await db.prepare('SELECT payload,shared FROM recipes WHERE owner_id=? ORDER BY updated_at DESC LIMIT 3000').bind(user.id).all();
      return respond({recipes:(res.results || []).map(row=>({...JSON.parse(row.payload),shared:Boolean(row.shared)}))});
    }
    const own = /^recipes\/([a-zA-Z0-9_-]{1,80})$/.exec(path);
    if (own && method === 'PUT') {
      const body = await readJson(request); const recipe=normalizeRecipe(body,own[1]);
      await db.prepare('INSERT INTO recipes(owner_id,id,payload,shared,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET payload=excluded.payload,shared=excluded.shared,updated_at=excluded.updated_at')
        .bind(user.id,own[1],JSON.stringify(recipe),recipe.shared?1:0,recipe.updatedAt).run();
      return respond({recipe});
    }
    if (own && method === 'DELETE') {
      await db.prepare('DELETE FROM recipes WHERE owner_id=? AND id=?').bind(user.id,own[1]).run();
      return respond({ok:true});
    }
    if (path === 'shared' && method === 'GET') {
      const data = await db.prepare(`SELECT recipes.payload,users.username FROM recipes INNER JOIN users ON users.id=recipes.owner_id WHERE recipes.shared=1 ORDER BY recipes.updated_at DESC LIMIT 200`).all();
      return respond({recipes:(data.results||[]).map(x=>shareSafe(JSON.parse(x.payload),x.username))});
    }
    return fail('ページが見つかりません',404);
  } catch (error) {
    if (/レシピ|JSON|データが大きすぎます/.test(error.message || '')) return fail(error.message,400);
    console.error('recipebox api error',String(error));
    return fail('サーバーでエラーが発生しました。時間をおいてお試しください',500);
  }
}