import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { InsideOutService } from '../src/core/service.js';

const backupScript = fileURLToPath(new URL('../scripts/backup.js', import.meta.url));
const clock = () => new Date('2026-10-29T04:00:00.000Z');

function runBackup(command, source, destination) {
  return spawnSync(process.execPath, [backupScript, command, '--from', source, '--to', destination], { encoding: 'utf8', timeout: 15000 });
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'insideout-backup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source 数据目录');
  const backup = join(root, 'backup 副本');
  const restored = join(root, 'restored 数据目录');
  const service = new InsideOutService({ dataDir: source, clock });
  const input = content => ({ content, source: { type: 'user', sessionId: 'session-A', turnId: content.slice(0, 20) }, visibility: 'session' });
  const active = service.createMemory(input('BACKUP_ACTIVE_7149 活跃经历'));
  const archived = service.createMemory(input('BACKUP_ARCHIVE_8143 封存经历'));
  service.archiveMemory(archived.id, { expectedVersion: archived.version, reason: '备份双库测试' });
  service.buildContext({ sessionId: 'session-A', turnId: 'before-backup', query: 'BACKUP_ACTIVE_7149' });
  service.requestRecall(archived.id, { sessionId: 'session-A' });
  const cold = service.getMemory(archived.id, { tier: 'archive' });
  assert.equal(service.db.prepare('SELECT COUNT(*) AS count FROM grants').get().count, 1);
  service.close();
  return { root, source, backup, restored, active, archived: cold };
}

test('backup and restore preserve both memory stores but clear temporary disclosure grants', (t) => {
  const f = fixture(t);
  const created = runBackup('create', f.source, f.backup);
  assert.equal(created.status, 0, created.stderr);
  const manifest = JSON.parse(readFileSync(join(f.backup, 'manifest.json'), 'utf8'));
  assert.equal(manifest.format, 'dsh-pseudo-insideout-backup');
  assert.deepEqual(manifest.files.map(file => file.path).sort(), ['active/insideout.sqlite', 'archive/insideout.sqlite']);
  const restored = runBackup('restore', f.backup, f.restored);
  assert.equal(restored.status, 0, restored.stderr);
  const service = new InsideOutService({ dataDir: f.restored, clock });
  try {
    assert.deepEqual(service.getMemory(f.active.id, { tier: 'active' }), f.active);
    assert.deepEqual(service.getMemory(f.archived.id, { tier: 'archive' }), f.archived);
    assert.equal(service.listMemories({ tier: 'active' }).total, 1);
    assert.equal(service.listMemories({ tier: 'archive' }).total, 1);
    assert.equal(service.db.prepare('SELECT COUNT(*) AS count FROM grants').get().count, 0);
    assert.equal(service.state().recentRecall, null);
    assert.ok(!service.buildContext({ sessionId: 'session-A', turnId: 'after-restore', query: 'BACKUP_ARCHIVE_8143' }).text.includes('BACKUP_ARCHIVE_8143'));
  } finally {
    service.close();
  }
  const original = new InsideOutService({ dataDir: f.source, clock });
  try {
    assert.equal(original.db.prepare('SELECT COUNT(*) AS count FROM grants').get().count, 1, 'restore must not modify the source database');
  } finally {
    original.close();
  }
});

test('restore rejects a backup whose stored file hash no longer matches', (t) => {
  const f = fixture(t);
  const created = runBackup('create', f.source, f.backup);
  assert.equal(created.status, 0, created.stderr);
  const filename = join(f.backup, 'archive', 'insideout.sqlite');
  const bytes = readFileSync(filename);
  bytes[bytes.length - 1] ^= 0xff;
  writeFileSync(filename, bytes);
  const result = runBackup('restore', f.backup, f.restored);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /校验失败/);
  assert.equal(existsSync(f.restored), false);
  assert.ok(!readdirSync(f.root).some(name => name.startsWith('restored 数据目录.partial-')), 'failed restore removes its incomplete staging directory');
});

test('backup creation and restoration refuse to overwrite any existing target', (t) => {
  const f = fixture(t);
  const created = runBackup('create', f.source, f.backup);
  assert.equal(created.status, 0, created.stderr);
  mkdirSync(f.restored);
  writeFileSync(join(f.restored, 'keep.txt'), '用户已有内容');
  for (const [command, source] of [['create', f.source], ['restore', f.backup]]) {
    const result = runBackup(command, source, f.restored);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /目标已存在/);
    assert.equal(readFileSync(join(f.restored, 'keep.txt'), 'utf8'), '用户已有内容');
    assert.deepEqual(readdirSync(f.restored), ['keep.txt']);
  }
});
