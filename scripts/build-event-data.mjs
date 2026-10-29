import { readFile, writeFile, mkdir } from 'node:fs/promises';

const sourcePath = new URL('../data/archive.json', import.meta.url);
const destinationPath = new URL('../data/events.json', import.meta.url);
const archive = JSON.parse(await readFile(sourcePath, 'utf8'));
const blocks = archive.blocks ?? {};

function textOf(value) {
  return Array.isArray(value) ? value.map((part) => (Array.isArray(part) ? String(part[0] ?? '') : '')).join('') : '';
}
function titleOf(block) { return textOf(block?.properties?.title) || textOf(block?.properties?.caption); }
function childBlocks(block) { return (block?.content ?? []).map((id) => blocks[id]).filter(Boolean); }
function allDescendants(block, seen = new Set()) {
  if (!block || seen.has(block.id)) return [];
  seen.add(block.id);
  return childBlocks(block).flatMap((child) => [child, ...allDescendants(child, seen)]);
}
function splitField(value) {
  const match = value.match(/^\s*([^：:]+)\s*[：:]\s*([\s\S]*)$/);
  return match ? [match[1].replace(/\s/g, ''), match[2].trim()] : null;
}
function dateAndTitle(value) {
  const match = value.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*(\d{1,2})時(?:\s*(\d{1,2})分)?)?\s*[：:]\s*(.+)$/);
  if (!match) return null;
  const [, year, month, day, hour = '', minute = '', title] = match;
  return { date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${hour ? `T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : ''}`, year, month: Number(month), day: Number(day), time: hour ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '', title: title.trim() };
}

const eventRoot = Object.values(blocks).find((block) => titleOf(block) === 'イベント出演情報');
if (!eventRoot) throw new Error('イベント出演情報の親ブロックが見つかりません。');

const events = allDescendants(eventRoot)
  .map((block) => {
    const base = dateAndTitle(titleOf(block));
    if (!base) return null;
    const fields = {};
    const rawFields = childBlocks(block).map(titleOf);
    for (const raw of rawFields) { const field = splitField(raw); if (field && field[1]) fields[field[0]] = field[1]; }
    const combined = `${base.title}\n${rawFields.join('\n')}`;
    return { ...base, venue: fields.会場 ?? '', benefit: fields.予約特典 ?? fields.イベント特典 ?? '', price: fields.料金 ?? '', drink: fields.D代 ?? '', performers: fields.出演者 ?? '', outfit: fields.衣装 ?? '', guests: fields.共演者 ?? '', url: fields.イベントURL ?? '', status: /中止/.test(combined) ? 'cancelled' : /延期/.test(combined) ? 'postponed' : '' };
  })
  .filter(Boolean)
  .sort((a, b) => a.date.localeCompare(b.date, 'ja') || a.title.localeCompare(b.title, 'ja'));

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(destinationPath, `${JSON.stringify({ sourceSyncedAt: archive.syncedAt, events })}\n`, 'utf8');
console.log(`Generated ${events.length} event records.`);
