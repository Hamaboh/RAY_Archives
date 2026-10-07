#!/usr/bin/env node

/**
 * Download the public RAY Notion archive into data/archive.json.
 *
 * The source page is publicly shared; no Notion token is required.  The output
 * intentionally keeps the original block hierarchy and properties so the site
 * can show every entry and can be re-synced without hand-maintained copies.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_ID = '3b99b75f-ba95-8053-a405-e67018a0ba59';
const API_URL = 'https://www.notion.so/api/v3/getRecordValues';
const SOURCE_URL =
  'https://app.notion.com/p/dotstokyo-idol-archive/RAY_Archive-Codex-3b99b75fba958053a405e67018a0ba59?source=copy_link';
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/archive.json');
const batchSize = 80;

const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

function retainPublicFields(block) {
  const fields = [
    'id',
    'type',
    'properties',
    'content',
    'format',
    'collection_id',
    'view_id',
    'view_ids',
    'parent_id',
    'parent_table',
    'alive',
    'created_time',
    'last_edited_time',
  ];
  return Object.fromEntries(fields.filter((field) => block[field] !== undefined).map((field) => [field, block[field]]));
}

async function getValues(ids, attempt = 0) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'RAY-Archives-sync/1.0',
    },
    body: JSON.stringify({
      requests: ids.map((id) => ({ table: 'block', id })),
    }),
  });

  const text = await response.text();
  if (!response.ok || text.startsWith('error code: 1015')) {
    if (attempt >= 7) {
      throw new Error(`Notion request failed (${response.status}): ${text.slice(0, 200)}`);
    }
    const waitMilliseconds = Math.min(60_000, 1_500 * 2 ** attempt);
    console.warn(`Notion is rate-limiting; retrying in ${Math.round(waitMilliseconds / 1000)}s…`);
    await pause(waitMilliseconds);
    return getValues(ids, attempt + 1);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse Notion response: ${text.slice(0, 200)}`);
  }
  return data.results ?? [];
}

async function loadExistingBlocks() {
  try {
    const previous = JSON.parse(await readFile(outputPath, 'utf8'));
    return previous.blocks ?? {};
  } catch {
    return {};
  }
}

const blocks = await loadExistingBlocks();
for (const [id, block] of Object.entries(blocks)) blocks[id] = retainPublicFields(block);
const discovered = new Set([ROOT_ID]);
const complete = new Set(Object.keys(blocks));

async function saveSnapshot() {
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.next`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify({
      schemaVersion: 1,
      sourceUrl: SOURCE_URL,
      sourceRootId: ROOT_ID,
      syncedAt: new Date().toISOString(),
      blocks,
    })}\n`,
    'utf8',
  );
  await rename(temporaryPath, outputPath);
}

for (const block of Object.values(blocks)) {
  for (const childId of block.content ?? []) discovered.add(childId);
}

while (true) {
  const pending = [...discovered].filter((id) => !complete.has(id));
  if (pending.length === 0) break;

  const currentBatch = pending.slice(0, batchSize);
  const results = await getValues(currentBatch);

  for (const result of results) {
    const block = result?.value;
    if (!block?.id) continue;
    blocks[block.id] = retainPublicFields(block);
    complete.add(block.id);
    for (const childId of block.content ?? []) discovered.add(childId);
  }

  // Missing/deleted records should not leave this sync in an endless loop.
  for (const id of currentBatch) complete.add(id);

  console.log(`Collected ${Object.keys(blocks).length} blocks; ${[...discovered].filter((id) => !complete.has(id)).length} remaining`);
  // A partial snapshot makes a long, rate-limited sync safely resumable.
  await saveSnapshot();
  // Keep the public endpoint comfortably below its request-rate threshold.
  await pause(1_200);
}

const archive = {
  schemaVersion: 1,
  sourceUrl: SOURCE_URL,
  sourceRootId: ROOT_ID,
  syncedAt: new Date().toISOString(),
  blocks,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(archive)}\n`, 'utf8');
console.log(`Saved ${Object.keys(blocks).length} blocks to ${outputPath}`);
