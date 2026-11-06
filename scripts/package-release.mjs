// Build the same installable assets locally and in the tag release workflow.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/release');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const tag = `v${pkg.version}`;
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
if (process.env.RELEASE_TAG) assert.equal(process.env.RELEASE_TAG, tag, 'Tag must match package.json');
const repo = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
const filename = `${pkg.name}-${pkg.version}.tgz`;
const download = `${repo}/releases/download/${tag}/${filename}`;
const install = await readFile(join(root, 'INSTALL.md'), 'utf8');
assert.ok(install.includes(download), 'INSTALL.md must link to the current version');
const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf8');
const entry = changelog.split(`## [${pkg.version}] - `)[1];
assert.ok(entry, 'CHANGELOG.md must contain the current version');
const changes = entry.slice(entry.indexOf('\n') + 1).split('\n## ')[0].split('\n[')[0].trim();

await mkdir(output, { recursive: true });
assert.ok(process.env.npm_execpath, 'Run this script with npm run release:pack');
const [pack] = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', output], { cwd: root, encoding: 'utf8' }));
assert.equal(pack.filename, filename);
const paths = pack.files.map(file => file.path);
for (const required of ['package.json', 'cordis.patch.yml', 'src/dsh/host.js', 'src/dsh/client.js', 'src/core/global-memory.js', 'web/index.html', 'web/app.js', 'web/appearance.js', 'web/themes.css', 'web/assets/logo.png', 'INSTALL.md', 'CHANGELOG.md', 'LICENSE']) {
  assert.ok(paths.includes(required), `Missing package file: ${required}`);
}
for (const path of paths) {
  assert.ok(/^(?:src\/|web\/|docs\/|scripts\/|package\.json$|cordis\.patch\.yml$|README\.md$|INSTALL\.md$|CHANGELOG\.md$|LICENSE$)/.test(path), `Unexpected package file: ${path}`);
  assert.ok(!/(?:^|\/)(?:\.env(?:\.|$)|node_modules\/)|\.(?:sqlite(?:-wal|-shm)?|db|log|tgz)$/.test(path), `Local data must not be packaged: ${path}`);
}
await writeFile(join(output, 'INSTALL.md'), install);
const sums = await Promise.all([filename, 'INSTALL.md'].map(async name => `${createHash('sha256').update(await readFile(join(output, name))).digest('hex')}  ${name}`));
await writeFile(join(output, 'SHA256SUMS'), `${sums.join('\n')}\n`);
await writeFile(join(output, 'RELEASE-NOTES.md'), `${changes}\n\n---\n\n${install}`);
console.log(JSON.stringify({ version: pkg.version, tag, package: filename, files: paths.length, download, sha256: sums[0].split(' ')[0], output }, null, 2));
