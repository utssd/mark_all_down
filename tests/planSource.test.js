// Unit tests for claude-diff/planSource.js.
//
// Focused on the cwd-matched sort: when `projectCwd` is supplied, plans that
// were authored by any session under ~/.claude/projects/<encoded-cwd>/ float
// to the top regardless of mtime. Everything else sorts by mtime desc.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  listPlans,
  collectPlanPathsForProjectCwd,
  projectEncodedName,
} = require('../claude-diff/planSource');

function mktempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'planSource-'));
}

function writePlan(plansDir, name, mtimeMs) {
  const p = path.join(plansDir, name);
  fs.writeFileSync(p, `# ${name}\n\nfirst paragraph for ${name}\n`);
  fs.utimesSync(p, mtimeMs / 1000, mtimeMs / 1000);
  return p;
}

function writeSession(projectsDir, encoded, sessionId, planPaths) {
  const dir = path.join(projectsDir, encoded);
  fs.mkdirSync(dir, { recursive: true });
  const records = planPaths.map((fp) => JSON.stringify({
    message: {
      content: [{ type: 'tool_use', name: 'Write', input: { file_path: fp, content: '' } }],
    },
  }));
  const filePath = path.join(dir, `${sessionId}.jsonl`);
  fs.writeFileSync(filePath, records.join('\n') + '\n');
  return filePath;
}

test('projectEncodedName mirrors Claude Code dir encoding', () => {
  assert.equal(projectEncodedName('/home/u/workspace/foo'), '-home-u-workspace-foo');
  assert.equal(projectEncodedName('/home/u/workspace/markalldown'), '-home-u-workspace-markalldown');
  assert.equal(projectEncodedName('/a'), '-a');
  assert.equal(projectEncodedName(null), null);
  assert.equal(projectEncodedName(''), null);
  assert.equal(projectEncodedName(undefined), null);
});

test('listPlans without projectCwd sorts by mtime desc, cwdMatch is false', () => {
  const root = mktempRoot();
  try {
    const plansDir = path.join(root, 'plans');
    fs.mkdirSync(plansDir);
    const older = writePlan(plansDir, 'older.md', Date.now() - 10_000);
    const newer = writePlan(plansDir, 'newer.md', Date.now());
    const out = listPlans({ plansDir, projectsDir: path.join(root, 'projects') });
    assert.deepEqual(out.map((p) => p.path), [newer, older]);
    assert.equal(out.every((p) => p.cwdMatch === false), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('listPlans with projectCwd floats cwd-matched plans above newer non-matches', () => {
  const root = mktempRoot();
  try {
    const plansDir = path.join(root, 'plans');
    const projectsDir = path.join(root, 'projects');
    fs.mkdirSync(plansDir);
    const cwd = '/home/u/proj/alpha';
    const encoded = projectEncodedName(cwd);

    // Older plan was written by a session under /home/u/proj/alpha.
    // Newer plan was never referenced by any session.
    const olderMatched = writePlan(plansDir, 'older-matched.md', Date.now() - 60_000);
    const newerUnmatched = writePlan(plansDir, 'newer-unmatched.md', Date.now());
    writeSession(projectsDir, encoded, 'sess-1', [olderMatched]);

    const out = listPlans({ plansDir, projectsDir, projectCwd: cwd });
    assert.deepEqual(out.map((p) => p.path), [olderMatched, newerUnmatched]);
    assert.equal(out[0].cwdMatch, true);
    assert.equal(out[1].cwdMatch, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('listPlans cwd-scoped section is also sorted by mtime desc', () => {
  const root = mktempRoot();
  try {
    const plansDir = path.join(root, 'plans');
    const projectsDir = path.join(root, 'projects');
    fs.mkdirSync(plansDir);
    const cwd = '/home/u/proj/beta';
    const encoded = projectEncodedName(cwd);

    const matchedOld = writePlan(plansDir, 'match-old.md', Date.now() - 60_000);
    const matchedNew = writePlan(plansDir, 'match-new.md', Date.now() - 5_000);
    const unmatched = writePlan(plansDir, 'no-match.md', Date.now() - 30_000);
    writeSession(projectsDir, encoded, 'sess-a', [matchedOld, matchedNew]);

    const out = listPlans({ plansDir, projectsDir, projectCwd: cwd });
    assert.deepEqual(out.map((p) => p.path), [matchedNew, matchedOld, unmatched]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('collectPlanPathsForProjectCwd returns empty when no project dir exists', () => {
  const root = mktempRoot();
  try {
    const plansDir = path.join(root, 'plans');
    const projectsDir = path.join(root, 'projects');
    fs.mkdirSync(plansDir);
    fs.mkdirSync(projectsDir);
    const set = collectPlanPathsForProjectCwd({
      projectCwd: '/some/missing/cwd',
      projectsDir,
      plansDir,
    });
    assert.equal(set.size, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('collectPlanPathsForProjectCwd ignores tool_use writes outside plansDir', () => {
  const root = mktempRoot();
  try {
    const plansDir = path.join(root, 'plans');
    const projectsDir = path.join(root, 'projects');
    fs.mkdirSync(plansDir);
    const cwd = '/some/cwd';
    const encoded = projectEncodedName(cwd);
    const planFile = writePlan(plansDir, 'in-plans.md', Date.now());
    const nonPlanFile = path.join(root, 'somewhere-else.md');
    fs.writeFileSync(nonPlanFile, '# elsewhere\n');
    writeSession(projectsDir, encoded, 'sess-x', [planFile, nonPlanFile]);

    const set = collectPlanPathsForProjectCwd({ projectCwd: cwd, projectsDir, plansDir });
    assert.equal(set.size, 1);
    assert.equal(set.has(planFile), true);
    assert.equal(set.has(nonPlanFile), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
