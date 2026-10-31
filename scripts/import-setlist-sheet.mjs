import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';

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
function dateKey(value) {
  const japanese = clean(value).match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:(\d{1,2})時(?:(\d{1,2})分)?)?$/);
  const numeric = clean(value).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  const match = japanese || numeric;
  if (!match) return '';
  const [, year, month, day, hour = '', minute = ''] = match;
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return hour ? `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : date;
}

async function importRows(tsv) {
  const [header, ...rows] = parseTsv(tsv);
  const index = Object.fromEntries(header.map((label, column) => [clean(label), column]));
  const required = ['開催日時', '出演者', '形態', '種別', '曲順', '楽曲名'];
  const missing = required.filter((label) => !(label in index));
  if (missing.length) throw new Error(`必要な列がありません: ${missing.join(', ')}`);

  const value = (row, label) => clean(row[index[label]]);
  const setlistsByDate = new Map();
  let setlistRows = 0;
  rows.forEach((row) => {
    const date = dateKey(value(row, '開催日時'));
    const song = value(row, '楽曲名');
    if (!date || !song || song === '-') return;
    const setlist = {
      artist: value(row, '出演者'),
      form: value(row, '形態'),
      type: value(row, '種別'),
      order: value(row, '曲順'),
      song,
    };
    const items = setlistsByDate.get(date) ?? [];
    items.push(setlist);
    setlistsByDate.set(date, items);
    setlistRows += 1;
  });
  const archive = JSON.parse(await readFile(outputPath, 'utf8'));
  let matchedEvents = 0;
  archive.events.forEach((event) => {
    const setlists = setlistsByDate.get(event.date) ?? [];
    event.setlists = setlists;
    if (setlists.length) matchedEvents += 1;
  });
  const eventDates = new Set(archive.events.map((event) => event.date));
  const unmatchedDates = [...setlistsByDate.keys()].filter((date) => !eventDates.has(date));
  archive.setlistsSource = 'Google スプレッドシート「セットリスト」';
  archive.setlistsSyncedAt = new Date().toISOString();
  await writeFile(outputPath, `${JSON.stringify(archive)}\n`, 'utf8');
  return { eventRecords: archive.events.length, setlistRows, matchedEvents, unmatchedDates: unmatchedDates.length, firstUnmatchedDate: unmatchedDates[0] ?? null };
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><meta charset="utf-8"><title>セットリストを同期</title><style>body{margin:2rem;background:#111;color:#fff;font-family:Meiryo,sans-serif}textarea{display:block;box-sizing:border-box;width:100%;height:70vh;margin:1rem 0;background:#222;color:#fff;border:1px solid #777;font:12px/1.4 monospace}button{padding:.7rem 1rem;background:#fff;color:#111;border:0;font-weight:bold}#result{margin-top:1rem}</style><h1>セットリストを同期</h1><p>スプレッドシートからコピーした内容を貼り付けてください。</p><form id="form"><textarea id="tsv" autofocus></textarea><button>サイト用データを更新</button></form><p id="result"></p><script>form.addEventListener('submit',async(e)=>{e.preventDefault();result.textContent='更新中…';const r=await fetch('/import',{method:'POST',body:tsv.value});result.textContent=await r.text();});</script>`);
    return;
  }
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

server.listen(4175, '127.0.0.1', () => console.log('Ready on http://127.0.0.1:4175'));
