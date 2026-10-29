import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';

const outputPath = new URL('../data/events.json', import.meta.url);

function parseTsv(input) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && (quoted || value.length === 0)) {
      if (quoted && input[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === '\t' && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function clean(value) { return String(value ?? '').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim(); }
function isTrue(value) { return /^true$/i.test(clean(value)); }
function parseDate(value) {
  const match = clean(value).match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:(\d{1,2})時(?:(\d{1,2})分)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour = '', minute = ''] = match;
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return { date: hour ? `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : date, year, month: Number(month), day: Number(day), time: hour ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '' };
}

async function importRows(tsv) {
  const [header, ...rows] = parseTsv(tsv);
  const index = Object.fromEntries(header.map((label, column) => [clean(label), column]));
  const required = ['延期', '中止', '開催日時', '公演名', '会場', '予約特典', '料金', 'D代', '出演者', '衣装', '共演者', 'イベントURL'];
  const missing = required.filter((label) => !(label in index));
  if (missing.length) throw new Error(`必要な列がありません: ${missing.join(', ')}`);
  const value = (row, label) => clean(row[index[label]]);
  const events = rows.map((row) => {
    const base = parseDate(value(row, '開催日時'));
    const title = value(row, '公演名');
    if (!base || !title) return null;
    return {
      ...base,
      title,
      venue: value(row, '会場'),
      benefit: value(row, '予約特典'),
      price: value(row, '料金'),
      drink: value(row, 'D代'),
      performers: value(row, '出演者'),
      outfit: value(row, '衣装'),
      guests: value(row, '共演者'),
      url: value(row, 'イベントURL'),
      status: isTrue(value(row, '中止')) ? 'cancelled' : isTrue(value(row, '延期')) ? 'postponed' : '',
    };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date, 'ja') || a.title.localeCompare(b.title, 'ja'));
  await writeFile(outputPath, `${JSON.stringify({ source: 'Google スプレッドシート「イベント出演情報」', sourceSyncedAt: new Date().toISOString(), events })}\n`, 'utf8');
  return { events: events.length, first: events[0]?.date, last: events.at(-1)?.date };
}

const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/import') { response.writeHead(404).end(); return; }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    const result = await importRows(Buffer.concat(chunks).toString('utf8'));
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(result));
    console.log(JSON.stringify(result));
    server.close();
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
    console.error(error);
    server.close();
    process.exitCode = 1;
  }
});

server.listen(4174, '127.0.0.1', () => console.log('Ready on http://127.0.0.1:4174/import'));
