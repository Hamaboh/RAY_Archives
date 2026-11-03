import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';

const outputPath = new URL('../data/events.json', import.meta.url);
const flagColumns = {
  '遠征': 'travel',
  '延期': 'postponed',
  '中止': 'cancelled',
  'RAY主催': 'hosted',
  'ワンマンライブ': 'oneMan',
  '2マンライブ': 'twoMan',
  '3マンライブ': 'threeMan',
  'コラボ': 'collaboration',
  '生誕イベント / プロデュース公演': 'birthdayOrProduced',
  '特殊セット': 'specialSet',
  'RAY Acoustic Set': 'acousticSet',
  'PREDAWN': 'predawn',
  'RAY presents「Neighbor?」': 'neighbor',
  'RAY presents「Relationship」': 'relationship',
  'RAY/代代代/クロスノエシス 3WAY SPLIT『ATMOSPHERE』ALMOST TRANSPARENT': 'atmosphere',
  '内山結愛 presents「tie in reaction」': 'tieInReaction',
  'RAY×BELRING少女ハート SPLIT TOUR NO MY WAY': 'noMyWay',
  'RAY BAND SET': 'bandSet',
  'RAY FEEDBACK SET': 'feedbackSet',
  'RAY Percussion Set': 'percussionSet',
  'RAYCHANZWERK SET': 'chanzwerkSet',
  'EXPERIMENTAL VJ SET': 'experimentalVjSet',
  'RAY GROOVE SET': 'grooveSet',
  'RAY MOSH SET': 'moshSet',
  'RAYPHEX TWIN（RAY IDM SET）': 'rayphexTwin',
  '内山結愛弾き語り': 'uchiyamaSolo',
  '内山結愛 Acoustic Set': 'uchiyamaAcousticSet',
  'DJ内山結愛': 'djUchiyama',
  '甲斐莉乃生誕バンド': 'kaiBirthdayBand',
  '琴山しずく弾き語り': 'kotoyamaSolo',
  '琴山しずく生誕バンド「コットリアン」': 'kottrianBand',
  'DJ琴山しずく': 'djKotoyama',
  '琴山しずく TECHNO SET': 'kotoyamaTechnoSet',
  'hypermoshkotto': 'hypermoshkotto',
  '月海まお弾き語り': 'tsukiumiSolo',
  'DJ月海まお': 'djTsukiumi',
  '月海まお NOISE SET / Noise(BoB).': 'tsukiumiNoiseSet',
  '紬実詩 Acoustic Set': 'tsumugiAcousticSet',
  'DJ紬実詩 / DJ酸辣湯麺': 'djTsumugi',
  'エクストロメ': 'extrome',
  'Total Feedback': 'totalFeedback',
};

function parseTsv(input) {
  const delimiter = input.slice(0, input.indexOf('\n') === -1 ? input.length : input.indexOf('\n')).includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && (quoted || value.length === 0)) {
      if (quoted && input[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function clean(value) { return String(value ?? '').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim().replaceAll('紬実氏', '紬実詩'); }
function isTrue(value) { return /^true$/i.test(clean(value)); }
function parseDate(value) {
  const match = clean(value).match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:(\d{1,2})時(?:(\d{1,2})分)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour = '', minute = ''] = match;
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return { date: hour ? `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : date, year, month: Number(month), day: Number(day), time: hour ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '' };
}

async function importRows(tsv) {
  const existing = JSON.parse(await readFile(outputPath, 'utf8').catch(() => '{"events":[]}'));
  const existingByEvent = new Map((existing.events ?? []).map((event) => [`${event.date}\u0000${event.title}`, event]));
  const [header, ...rows] = parseTsv(tsv);
  const index = {};
  header.forEach((label, column) => {
    const key = clean(label);
    if (!(key in index)) index[key] = column;
  });
  const required = ['開催日時', '公演名', '会場', '予約特典', '料金', 'D代', '出演者', '衣装', '共演者', 'イベントURL', '備考'];
  const missing = required.filter((label) => !(label in index));
  if (missing.length) throw new Error(`必要な列がありません: ${missing.join(', ')}`);
  const value = (row, label) => clean(row[index[label]]);
  const noteValue = (row) => String(row[index['備考']] ?? '').replace(/\r\n?/g, '\n').trim().replaceAll('紬実氏', '紬実詩');
  const events = rows.map((row) => {
    const base = parseDate(value(row, '開催日時'));
    const title = value(row, '公演名');
    if (!base || !title) return null;
    const previous = existingByEvent.get(`${base.date}\u0000${title}`);
    const flags = Object.fromEntries(Object.entries(flagColumns)
      .filter(([label]) => label in index && isTrue(value(row, label)))
      .map(([, key]) => [key, true]));
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
      notes: '備考' in index ? noteValue(row) : '',
      ...flags,
      // セットリストは別シート由来のため、開催日時と公演名が一致する既存レコードから維持する。
      ...(previous?.setlists?.length ? { setlists: previous.setlists } : {}),
      // 現行シートに列がない間も、過去に確定した Total Feedback の分類を失わせない。
      ...(!('Total Feedback' in index) && previous?.totalFeedback ? { totalFeedback: true } : {}),
      status: flags.cancelled ? 'cancelled' : flags.postponed ? 'postponed' : '',
    };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date, 'ja') || a.title.localeCompare(b.title, 'ja'));
  const sourceFlagKeys = Object.entries(flagColumns).filter(([label]) => label in index).map(([, key]) => key);
  await writeFile(outputPath, `${JSON.stringify({ source: 'Google スプレッドシート「イベント出演情報」', sourceSyncedAt: new Date().toISOString(), sourceFlagKeys, events })}\n`, 'utf8');
  return { events: events.length, first: events[0]?.date, last: events.at(-1)?.date, sourceFlagKeys };
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><meta charset="utf-8"><title>イベント情報を同期</title><style>body{margin:2rem;background:#111;color:#fff;font-family:Meiryo,sans-serif}textarea{display:block;box-sizing:border-box;width:100%;height:70vh;margin:1rem 0;background:#222;color:#fff;border:1px solid #777;font:12px/1.4 monospace}button{padding:.7rem 1rem;background:#fff;color:#111;border:0;font-weight:bold}#result{margin-top:1rem}</style><h1>イベント情報を同期</h1><p>スプレッドシートからコピーした内容を貼り付けてください。</p><form id="form"><textarea id="tsv" autofocus></textarea><button>サイト用データを更新</button></form><p id="result"></p><script>form.addEventListener('submit',async(e)=>{e.preventDefault();result.textContent='更新中…';const r=await fetch('/import',{method:'POST',body:tsv.value});result.textContent=await r.text();});</script>`);
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

if (process.env.IMPORT_FILE) {
  const result = await importRows(await readFile(process.env.IMPORT_FILE, 'utf8'));
  console.log(JSON.stringify(result));
} else {
  const port = Number(process.env.IMPORT_PORT ?? 4174);
  server.listen(port, '127.0.0.1', () => console.log(`Ready on http://127.0.0.1:${port}/import`));
}
