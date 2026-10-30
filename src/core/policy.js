import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, lstatSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { InsideOutError } from './service.js';

/** Profile-wide default. Contains no conversations, paths or memory bodies. */
export class MemoryDefaults {
  constructor({ dataDir, scope = 'profile', clock = () => new Date() }) {
    if (!dataDir) throw new InsideOutError('INVALID_INPUT', '必须指定默认设置目录');
    this.scope = scope; this.clock = clock; this.listeners = new Set();
    const root = resolve(dataDir); mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw new InsideOutError('UNSAFE_PATH', '设置目录不能是符号链接');
    const file = join(root, 'memory-default.sqlite');
    try { if (lstatSync(file).isSymbolicLink()) throw new InsideOutError('UNSAFE_PATH', '设置数据库不能是符号链接'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.db = new DatabaseSync(file); chmodSync(file, 0o600);
    this.db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;');
    this.db.exec('CREATE TABLE IF NOT EXISTS memory_default (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, enabled INTEGER NOT NULL, updatedAt TEXT); INSERT OR IGNORE INTO memory_default VALUES (1,0,1,NULL);');
  }
  get() {
    const row = this.db.prepare('SELECT version,enabled,updatedAt FROM memory_default WHERE id=1').get();
    return { ...row, enabled: Boolean(row.enabled), scope: this.scope };
  }
  update({ expectedVersion, enabled }) {
    if (typeof enabled !== 'boolean') throw new InsideOutError('INVALID_INPUT', '默认记忆开关必须为布尔值');
    this.db.exec('BEGIN IMMEDIATE');
    let next;
    try {
      const current = this.get();
      if (!Number.isInteger(expectedVersion) || expectedVersion !== current.version) throw new InsideOutError('VERSION_CONFLICT', '默认设置已变化，请刷新后再操作', 409);
      this.db.prepare('UPDATE memory_default SET version=version+1,enabled=?,updatedAt=? WHERE id=1').run(enabled ? 1 : 0, new Date(this.clock()).toISOString());
      next = this.get(); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    for (const fn of this.listeners) { try { fn(next); } catch {} }
    return next;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  close() { this.listeners.clear(); this.db.close(); }
}
