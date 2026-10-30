#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, copyFileSync, writeFileSync, readFileSync, renameSync, rmSync, lstatSync, chmodSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const arg = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const FILES = ['active/insideout.sqlite', 'archive/insideout.sqlite'];
const denyLink = path => { if (lstatSync(path).isSymbolicLink()) throw new Error('拒绝符号链接'); };
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true, mode: 0o700 }); copyFileSync(from, to); chmodSync(to, 0o600); };
const from = arg('--from'), target = arg('--to');
if (!from || !target || (!args.includes('create') && !args.includes('restore'))) {
  console.error('用法：node scripts/backup.js create --from <数据根> --to <全新备份目录>\n或：node scripts/backup.js restore --from <备份目录> --to <全新数据根>');
  process.exit(2);
}
const source = resolve(from), destination = resolve(target);
if (existsSync(destination)) throw new Error('目标已存在；为防覆盖，请指定全新目录');
denyLink(source);
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
const staging = `${destination}.partial-${randomUUID()}`;
let db;
try {
  mkdirSync(staging, { mode: 0o700 });
  if (args.includes('create')) {
    const active = join(source, FILES[0]); denyLink(active);
    db = new DatabaseSync(active);
    db.exec('PRAGMA busy_timeout=5000');
    const cold = join(source, FILES[1]);
    if (existsSync(cold)) { denyLink(cold); db.prepare('ATTACH DATABASE ? AS cold').run(cold); }
    // Lock both attached rollback-journal databases before copying a stable snapshot.
    // Do not call the service/mutate records while the snapshot transaction is open.
    db.exec('BEGIN IMMEDIATE');
    const entries = [];
    for (const file of FILES) if (existsSync(join(source, file))) {
      const filePath = join(source, file); denyLink(filePath); copy(filePath, join(staging, file)); entries.push({ path: file, sha256: hash(join(staging, file)) });
    }
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ format: 'dsh-pseudo-insideout-backup', version: 1, createdAt: new Date().toISOString(), files: entries }, null, 2), { mode: 0o600 });
    db.exec('COMMIT'); db.close(); db = null;
  } else {
    const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
    if (manifest.format !== 'dsh-pseudo-insideout-backup' || manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.some(v => v.path === FILES[0])) throw new Error('备份清单无效');
    for (const entry of manifest.files) {
      if (!FILES.includes(entry.path)) throw new Error('备份包含非预期路径');
      const file = join(source, entry.path); denyLink(file);
      if (hash(file) !== entry.sha256) throw new Error('备份校验失败，未恢复任何数据');
      copy(file, join(staging, entry.path));
      const check = new DatabaseSync(join(staging, entry.path));
      try {
        if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok' || check.prepare('PRAGMA user_version').get().user_version > 1) throw new Error('数据库完整性或版本校验失败');
      } finally { check.close(); }
    }
    // A restored snapshot never revives temporary disclosure authorizations.
    db = new DatabaseSync(join(staging, FILES[0]));
    db.exec("PRAGMA secure_delete=ON; DELETE FROM grants; DELETE FROM settings WHERE key IN ('recentRecall','recalls')"); db.close(); db = null;
  }
  renameSync(staging, destination);
  console.log(args.includes('create') ? '备份完成，清单与 SHA-256 已保存。备份含私密正文，请自行保管。' : '已恢复到新的数据目录；临时调阅授权已清空。原目录未修改。');
} catch (error) {
  if (db) { try { db.exec('ROLLBACK'); } catch {} db.close(); }
  rmSync(staging, { recursive: true, force: true });
  console.error(error.message); process.exitCode = 1;
}
