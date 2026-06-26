#!/usr/bin/env node
// =============================================================================
// scripts/check-doc-alignment.mjs
//
// Flex Work 2.0 plan lives across three artifacts that must stay aligned:
//   1. Prototype                — index.html
//   2. API reference            — Flex Work API Reference.html
//   3. Architecture (this doc)  — Flex Work 2.0 Architecture v<N.M>.html
//
// When any one changes, the other two need a review pass. This script:
//   • hashes each tracked doc (SHA-256 of file contents)
//   • compares the current hash to the last-accepted hash in
//       .doc-alignment.json
//   • prints a per-doc checklist of cross-references to verify
//   • exits non-zero until a human signs off by running `--accept`
//
// Usage:
//   node scripts/check-doc-alignment.mjs           # check; fails on drift
//   node scripts/check-doc-alignment.mjs --accept  # record current hashes
//   node scripts/check-doc-alignment.mjs --status  # show hashes only
//
// Wire into CI by adding a step that runs the no-flag form; the run fails if
// any tracked doc changed without a matching `--accept` commit.
// =============================================================================

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const STATE_FILE = resolve(ROOT, '.doc-alignment.json');

// -----------------------------------------------------------------------------
// Tracked documents + the cross-reference checklist each one triggers.
// Keep the architecture entry's `path` updated when a new version ships.
// -----------------------------------------------------------------------------
const DOCS = [
  {
    id: 'prototype',
    label: 'Prototype',
    path: 'index.html',
    checklist: [
      'API reference: every new screen reading or writing data has matching endpoints in Flex Work API Reference.html',
      'Architecture: new flows belong on the §09 lifecycle map',
      'Architecture: new objects belong in §05 (core object model) + §16 (database schema)',
      'Architecture: new roles or surfaces are reflected in §03 + §11',
    ],
  },
  {
    id: 'api',
    label: 'API reference',
    path: 'Flex Work API Reference.html',
    checklist: [
      'Architecture: every new endpoint maps to a Mirror/Extend/Net-new table in §05 + §16',
      'Architecture: every new endpoint maps to a §08 connector or §10 ownership row',
      'Prototype: any new endpoint that a screen will call is wired into the UI',
      'Shared SDK: regenerate shared/api-types.ts after merge',
    ],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    // Resolves to the latest versioned file in the project root.
    path: resolveLatestArchitecture,
    checklist: [
      'API reference: new tables or fields surface as new endpoints or response fields',
      'Prototype: any new role, surface, or lifecycle stage has a screen',
      'Tech stack changes in §12: docker-compose, CI, and Gemfile.lock reflect the bump',
      'Build-order changes in §14: scripts/ and ROADMAP are consistent with the new sequence',
    ],
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
async function resolveLatestArchitecture() {
  // Find the highest-versioned "Flex Work 2.0 Architecture v<N.M>.html" file.
  const entries = await readdir(ROOT);
  const matches = entries
    .map((name) => {
      const m = name.match(/^Flex Work 2\.0 Architecture v(\d+)\.(\d+)\.html$/);
      if (!m) return null;
      return { name, major: Number(m[1]), minor: Number(m[2]) };
    })
    .filter(Boolean)
    .sort((a, b) => (b.major - a.major) || (b.minor - a.minor));
  if (!matches.length) {
    throw new Error('No Flex Work 2.0 Architecture v<N.M>.html files found in project root.');
  }
  return matches[0].name;
}

async function hashFile(absPath) {
  const buf = await readFile(absPath);
  return createHash('sha256').update(buf).digest('hex');
}

async function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { acceptedAt: null, hashes: {} };
  }
  return JSON.parse(await readFile(STATE_FILE, 'utf8'));
}

async function saveState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

async function resolveDocPath(doc) {
  const p = typeof doc.path === 'function' ? await doc.path() : doc.path;
  return { rel: p, abs: resolve(ROOT, p) };
}

// ANSI styling (keeps things readable in CI logs without a dependency).
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  const args = new Set(process.argv.slice(2));
  const accept = args.has('--accept');
  const status = args.has('--status');

  const state = await loadState();
  const current = {};
  const changed = [];

  for (const doc of DOCS) {
    const { rel, abs } = await resolveDocPath(doc);
    if (!existsSync(abs)) {
      console.error(`${c.red}✗${c.reset} Missing tracked doc: ${rel}`);
      process.exit(2);
    }
    const hash = await hashFile(abs);
    current[doc.id] = { rel, hash };
    const last = state.hashes?.[doc.id]?.hash;
    if (last !== hash) changed.push({ doc, rel, hash, last });
  }

  if (status) {
    console.log(`${c.bold}Doc alignment — current hashes${c.reset}`);
    for (const doc of DOCS) {
      const { rel, hash } = current[doc.id];
      console.log(`  ${c.cyan}${doc.label.padEnd(16)}${c.reset} ${rel}`);
      console.log(`  ${c.dim}                  ${hash}${c.reset}`);
    }
    console.log();
    console.log(`Last accepted: ${state.acceptedAt ?? c.dim + '(never)' + c.reset}`);
    return;
  }

  if (accept) {
    await saveState({
      acceptedAt: new Date().toISOString(),
      hashes: Object.fromEntries(
        DOCS.map((d) => [d.id, { rel: current[d.id].rel, hash: current[d.id].hash }])
      ),
    });
    console.log(`${c.green}✓${c.reset} Recorded current doc hashes. Alignment review accepted.`);
    return;
  }

  if (!changed.length) {
    console.log(`${c.green}✓${c.reset} All tracked docs match the last accepted alignment review.`);
    return;
  }

  console.log(`${c.yellow}${c.bold}Doc alignment — review required${c.reset}`);
  console.log();
  console.log(`${changed.length} of ${DOCS.length} tracked doc(s) changed since the last accepted review.`);
  console.log(`Review the cross-references below, then run:`);
  console.log(`  ${c.cyan}node scripts/check-doc-alignment.mjs --accept${c.reset}`);
  console.log();

  for (const { doc, rel } of changed) {
    console.log(`${c.bold}${doc.label}${c.reset}  ${c.dim}${rel}${c.reset}`);
    for (const item of doc.checklist) {
      console.log(`  ${c.yellow}□${c.reset} ${item}`);
    }
    console.log();
  }

  console.log(`${c.dim}Tip: a PR that changes any of these docs must either edit the other two,`);
  console.log(`     or include a one-line note in the PR body explaining why they're unaffected.${c.reset}`);

  // Non-zero so CI blocks merge until --accept is committed.
  process.exit(1);
}

main().catch((err) => {
  console.error(`${c.red}check-doc-alignment failed:${c.reset}`, err);
  process.exit(2);
});
