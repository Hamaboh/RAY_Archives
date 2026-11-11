import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';

const outputPath = new URL('../data/media.json', import.meta.url);

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
  const label = clean(value);
  const match = label.match(/(\d{4})\s*(?:年|[/.\-])\s*(\d{1,2})\s*(?:月|[/.\-])\s*(\d{1,2})/);
  if (!match) return { date: '', year: '', month: 0, day: 0, dateLabel: label };
  const [, year, month, day] = match;
  return {
    date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    year,
    month: Number(month),
    day: Number(day),
    dateLabel: label,
  };
}

function artistList(value) {
  return clean(value).split(',').map((artist) => artist.trim()).filter((artist) => artist && artist !== '-');
}

function mediumList(value) {
  return clean(value).split(/,\s*(?=[^,]+?\s+-\s+)/).map((medium) => medium.trim()).filter(Boolean);
}

function urlList(value) {
  return clean(value).split(/,\s*(?=https?:\/\/)/).map((url) => url.trim()).filter(Boolean);
}

async function importRows(tsv) {
  const [headerRow = [], ...rows] = parseTsv(tsv);
  const headers = headerRow.map(clean);
  const index = Object.fromEntries(headers.map((label, column) => [label, column]));
  const required = ['発信日', 'タイトル', '媒体', '対象アーティスト', 'URL'];
  const missing = required.filter((label) => !(label in index));
  if (missing.length) throw new Error(`必要な列がありません: ${missing.join(', ')}`);

  const value = (row, label) => clean(row[index[label]]);
  const records = rows.flatMap((row) => {
    const fields = Object.fromEntries(headers.map((label, column) => [label, clean(row[column])]));
    const date = value(row, '発信日');
    const title = value(row, 'タイトル');
    const medium = value(row, '媒体');
    const artist = value(row, '対象アーティスト');
    const url = value(row, 'URL');
    if (![date, title, medium, artist, url].some(Boolean)) return [];
    const mediums = mediumList(medium);
    const urls = urlList(url);
    const count = Math.max(mediums.length, urls.length, 1);
    return Array.from({ length: count }, (_, recordIndex) => ({
      ...parseDate(date),
      title,
      medium: mediums[recordIndex] || (mediums.length === 1 ? mediums[0] : medium),
      artists: artistList(artist),
      url: urls[recordIndex] || (urls.length === 1 ? urls[0] : ''),
      fields,
    }));
  }).sort((first, second) => (
    (first.date || '9999-12-31').localeCompare(second.date || '9999-12-31', 'ja')
    || first.dateLabel.localeCompare(second.dateLabel, 'ja')
    || first.title.localeCompare(second.title, 'ja')
  ));

  await writeFile(outputPath, `${JSON.stringify({
    source: 'Google スプレッドシート「メディア情報」',
    sourceSyncedAt: new Date().toISOString(),
    columns: headers,
    media: records,
  })}\n`, 'utf8');
  return { media: records.length, columns: headers.length, newest: records[0]?.dateLabel || '' };
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><meta charset="utf-8"><title>メディア情報を同期</title><style>body{margin:2rem;background:#111;color:#fff;font-family:Meiryo,sans-serif}textarea{display:block;box-sizing:border-box;width:100%;height:70vh;margin:1rem 0;background:#222;color:#fff;border:1px solid #777;font:12px/1.4 monospace}button{padding:.7rem 1rem;background:#fff;color:#111;border:0;font-weight:bold}#result{margin-top:1rem}</style><h1>メディア情報を同期</h1><p>スプレッドシートからコピーした内容を貼り付けてください。</p><form id="form"><textarea id="tsv" autofocus></textarea><button>サイト用データを更新</button></form><p id="result"></p><script>form.addEventListener('submit',async(e)=>{e.preventDefault();result.textContent='更新中…';const r=await fetch('/import',{method:'POST',body:tsv.value});result.textContent=await r.text();});</script>`);
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

const port = Number(process.env.IMPORT_PORT ?? 4181);
server.listen(port, '127.0.0.1', () => console.log(`Ready on http://127.0.0.1:${port}`));
