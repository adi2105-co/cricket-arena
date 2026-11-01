// Storage layer: Postgres (Neon) in production, in-memory for tests and quick local demos.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'db', 'schema.sql'), 'utf8');

export class MemStore {
  constructor() { this.users = []; this.games = new Map(); this.scores = []; this.uid = 0; this.sid = 0; this.name = 'memory'; }
  async init() {}
  async createUser(username, hash) {
    if (this.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) { const e = new Error('dup'); e.code = '23505'; throw e; }
    const u = { id: ++this.uid, username, pass_hash: hash, created_at: new Date() };
    this.users.push(u);
    return { id: u.id, username };
  }
  async findUser(username) { return this.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null; }
  async userById(id) { return this.users.find((u) => u.id === id) || null; }
  async listGames(uid) {
    return [...this.games.values()].filter((g) => g.user_id === uid).sort((a, b) => b.updated_at - a.updated_at)
      .map(({ state, ...rest }) => rest);
  }
  async createGame(uid, { kind, title, status = 'active', summary = {}, state }) {
    const g = { id: randomUUID(), user_id: uid, kind, title, status, summary, state: JSON.parse(JSON.stringify(state)), created_at: new Date(), updated_at: new Date() };
    this.games.set(g.id, g);
    return g.id;
  }
  async getGame(uid, id) { const g = this.games.get(id); return g && g.user_id === uid ? { ...g, state: JSON.parse(JSON.stringify(g.state)) } : null; }
  async saveGame(uid, id, { title, status, summary, state }) {
    const g = this.games.get(id);
    if (!g || g.user_id !== uid) return false;
    Object.assign(g, { title, status, summary, state: JSON.parse(JSON.stringify(state)), updated_at: new Date() });
    return true;
  }
  async deleteGame(uid, id) { const g = this.games.get(id); if (!g || g.user_id !== uid) return false; this.games.delete(id); return true; }
  async addScore(uid, mode, score, meta) { this.scores.push({ id: ++this.sid, user_id: uid, mode, score, meta, created_at: new Date() }); }
  async leaderboard(mode, limit = 20) {
    const best = new Map();
    for (const s of this.scores.filter((x) => x.mode === mode)) {
      const cur = best.get(s.user_id);
      if (!cur || s.score > cur.score) best.set(s.user_id, s);
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit)
      .map((s) => ({ username: this.users.find((u) => u.id === s.user_id).username, score: s.score, meta: s.meta, at: s.created_at }));
  }
}

export class PgStore {
  constructor(url) {
    this.url = url;
    this.name = 'postgres';
    this.ready = null;
  }
  async pool() {
    if (this._pool) return this._pool;
    const { default: pg } = await import('pg');
    const u = new URL(this.url);
    u.searchParams.delete('channel_binding'); // not supported by node-postgres
    this._pool = new pg.Pool({ connectionString: u.toString(), max: process.env.VERCEL ? 2 : 8, idleTimeoutMillis: 20000, connectionTimeoutMillis: 15000, ssl: /localhost|127\.0\.0\.1/.test(u.hostname) ? false : { rejectUnauthorized: false } });
    this._pool.on('error', (e) => console.error('[pg] idle client error:', e.message));
    return this._pool;
  }
  q(text, params) { return this.pool().then((p) => p.query(text, params)); }
  init() {
    if (!this.ready) this.ready = this.q(SCHEMA).catch((e) => { this.ready = null; throw e; });
    return this.ready;
  }
  async createUser(username, hash) {
    const r = await this.q('INSERT INTO users (username, pass_hash) VALUES ($1,$2) RETURNING id, username', [username, hash]);
    return r.rows[0];
  }
  async findUser(username) { return (await this.q('SELECT * FROM users WHERE lower(username)=lower($1)', [username])).rows[0] || null; }
  async userById(id) { return (await this.q('SELECT id, username, created_at FROM users WHERE id=$1', [id])).rows[0] || null; }
  async listGames(uid) {
    return (await this.q('SELECT id, user_id, kind, title, status, summary, created_at, updated_at FROM games WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100', [uid])).rows;
  }
  async createGame(uid, { kind, title, status = 'active', summary = {}, state }) {
    const r = await this.q('INSERT INTO games (user_id, kind, title, status, summary, state) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [uid, kind, title, status, JSON.stringify(summary), JSON.stringify(state)]);
    return r.rows[0].id;
  }
  async getGame(uid, id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return (await this.q('SELECT * FROM games WHERE id=$1 AND user_id=$2', [id, uid])).rows[0] || null;
  }
  async saveGame(uid, id, { title, status, summary, state }) {
    const r = await this.q('UPDATE games SET title=$3, status=$4, summary=$5, state=$6, updated_at=now() WHERE id=$1 AND user_id=$2', [id, uid, title, status, JSON.stringify(summary), JSON.stringify(state)]);
    return r.rowCount > 0;
  }
  async deleteGame(uid, id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
    return (await this.q('DELETE FROM games WHERE id=$1 AND user_id=$2', [id, uid])).rowCount > 0;
  }
  async addScore(uid, mode, score, meta) { await this.q('INSERT INTO scores (user_id, mode, score, meta) VALUES ($1,$2,$3,$4)', [uid, mode, score, JSON.stringify(meta || {})]); }
  async leaderboard(mode, limit = 20) {
    const r = await this.q(`SELECT u.username, s.score, s.meta, s.created_at AS at FROM (
      SELECT DISTINCT ON (user_id) user_id, score, meta, created_at FROM scores WHERE mode=$1 ORDER BY user_id, score DESC, created_at ASC
    ) s JOIN users u ON u.id = s.user_id ORDER BY s.score DESC LIMIT $2`, [mode, limit]);
    return r.rows;
  }
}

export function makeStore(env = process.env) {
  if (env.DATABASE_URL) return new PgStore(env.DATABASE_URL);
  console.warn('[store] DATABASE_URL not set: using in-memory storage (data is lost when the server stops).');
  return new MemStore();
}
