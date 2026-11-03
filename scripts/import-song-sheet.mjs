import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';

const outputPath = new URL('../data/songs.json', import.meta.url);

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

function clean(value) {
  return String(value ?? '')
    .replace(/\r?\n+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .trim()
    .replaceAll('紬実氏', '紬実詩');
}

function parseDate(value) {
  const match = clean(value).match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:(\d{1,2})時(?:(\d{1,2})分)?)?$/);
  if (!match) return { date: '', year: '', month: 0, day: 0, time: '' };
  const [, year, month, day, hour = '', minute = ''] = match;
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return { date: hour ? `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : date, year, month: Number(month), day: Number(day), time: hour ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '' };
}

async function importRows(tsv) {
  const [header, ...rows] = parseTsv(tsv);
  const index = {};
  header.forEach((label, column) => {
    const key = clean(label);
    if (!(key in index)) index[key] = column;
  });
  const required = ['初披露日', '楽曲名', 'アーティスト', '活動形態', '種別', '原曲アーティスト', '作詞', '作曲', '編曲', '振付', 'アレンジver.'];
  const missing = required.filter((label) => !(label in index));
  if (missing.length) throw new Error(`必要な列がありません: ${missing.join(', ')}`);
  const value = (row, label) => clean(row[index[label]]);
  const songs = rows.map((row) => {
    const title = value(row, '楽曲名');
    if (!title) return null;
    return {
      ...parseDate(value(row, '初披露日')),
      title,
      artist: value(row, 'アーティスト'),
      form: value(row, '活動形態'),
      type: value(row, '種別'),
      originalArtist: value(row, '原曲アーティスト'),
      lyrics: value(row, '作詞'),
      composition: value(row, '作曲'),
      arrangement: value(row, '編曲'),
      choreography: value(row, '振付'),
      alternateVersion: value(row, 'アレンジver.'),
    };
  }).filter(Boolean).sort((first, second) => (first.date || '9999').localeCompare(second.date || '9999', 'ja') || first.title.localeCompare(second.title, 'ja'));
  await writeFile(outputPath, `${JSON.stringify({ source: 'Google スプレッドシート「オリジナル楽曲」', sourceSyncedAt: new Date().toISOString(), songs })}\n`, 'utf8');
  return { songs: songs.length, first: songs[0]?.title, last: songs.at(-1)?.title };
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><meta charset="utf-8"><title>楽曲情報を同期</title><style>body{margin:2rem;background:#111;color:#fff;font-family:Meiryo,sans-serif}textarea{display:block;box-sizing:border-box;width:100%;height:70vh;margin:1rem 0;background:#222;color:#fff;border:1px solid #777;font:12px/1.4 monospace}button{padding:.7rem 1rem;background:#fff;color:#111;border:0;font-weight:bold}#result{margin-top:1rem}</style><h1>楽曲情報を同期</h1><p>スプレッドシートからコピーした内容を貼り付けてください。</p><form id="form"><textarea id="tsv" autofocus></textarea><button>サイト用データを更新</button></form><p id="result"></p><script>form.addEventListener('submit',async(e)=>{e.preventDefault();result.textContent='更新中…';const r=await fetch('/import',{method:'POST',body:tsv.value});result.textContent=await r.text();});</script>`);
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

const port = Number(process.env.IMPORT_PORT ?? 4178);
server.listen(port, '127.0.0.1', () => console.log(`Ready on http://127.0.0.1:${port}`));
