/**
 * Build script - runs Next.js build.
 * Use this when pnpm/npm scripts fail due to path encoding (Cyrillic paths on Windows).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

console.log('Building Next.js app...');
console.log('Project root:', projectRoot);

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env },
});

process.exit(result.status ?? 1);
