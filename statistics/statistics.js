const $ = (selector) => document.querySelector(selector);
const heading = $('#statistics-heading');
const description = $('#statistics-description');
const chart = $('#statistics-chart');
const empty = $('#statistics-empty');

const colors = ['#f5f5f5', '#9fc5ff', '#ffbc8b', '#a8e6c1', '#d8b4fe', '#f7a8c8', '#fbef9a', '#7dd3fc', '#fca5a5', '#c4b5fd', '#86efac', '#fcd34d', '#f0abfc', '#67e8f9', '#fdba74', '#a3e635'];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);

function dateLabel(value) {
  const [date, time = ''] = value.split('T');
  const [year, month, day] = date.split('-');
  return `${year}/${Number(month)}/${Number(day)}${time ? ` ${time}` : ''}`;
}

function aggregate(entries) {
  const eventDates = [...new Set(entries.map((entry) => entry.date))].sort((first, second) => first.localeCompare(second, 'ja'));
  const songs = [...new Set(entries.map((entry) => entry.statisticSong))].sort((first, second) => first.localeCompare(second, 'ja'));
  const increments = new Map(entries.map((entry) => [`${entry.date}\u0000${entry.statisticSong}`, 0]));
  entries.forEach((entry) => increments.set(`${entry.date}\u0000${entry.statisticSong}`, (increments.get(`${entry.date}\u0000${entry.statisticSong}`) ?? 0) + 1));
  const cumulative = new Map(songs.map((song) => [song, []]));
  songs.forEach((song) => {
    let count = 0;
    eventDates.forEach((date) => {
      count += increments.get(`${date}\u0000${song}`) ?? 0;
      cumulative.get(song).push(count);
    });
  });
  return { eventDates, songs, cumulative, max: Math.max(1, ...[...cumulative.values()].flat()) };
}

function chartMarkup(model) {
  const { eventDates, songs, cumulative, max } = model;
  const left = 50;
  const top = 24;
  const bottom = 82;
  const height = 372;
  const pointGap = 70;
  const width = Math.max(840, left + 24 + Math.max(0, eventDates.length - 1) * pointGap + 45);
  const graphHeight = height - top - bottom;
  const x = (index) => left + (eventDates.length === 1 ? 0 : index * pointGap);
  const y = (value) => top + graphHeight - (value / max) * graphHeight;
  const tickCount = Math.min(max, 5);
  const ticks = [...new Set([...Array(tickCount + 1)].map((_, index) => Math.round((max / tickCount) * index)))].sort((first, second) => first - second);
  const grid = ticks.map((value) => `<g><line x1="${left}" x2="${width - 24}" y1="${y(value)}" y2="${y(value)}" /><text x="${left - 9}" y="${y(value) + 4}" text-anchor="end">${value}</text></g>`).join('');
  const lines = songs.map((song, songIndex) => {
    const values = cumulative.get(song);
    const color = colors[songIndex % colors.length];
    const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    return `<g class="statistics-series" data-song="${escapeHtml(song)}" style="--series:${color}"><polyline points="${points}" /></g>`;
  }).join('');
  const labels = eventDates.map((date, index) => `<text class="statistics-date" x="${x(index)}" y="${height - bottom + 21}" text-anchor="end" transform="rotate(-48 ${x(index)} ${height - bottom + 21})">${dateLabel(date)}</text>`).join('');
  const legend = songs.map((song, index) => `<li><button type="button" aria-pressed="true" data-song="${escapeHtml(song)}"><i style="--series:${colors[index % colors.length]}"></i><span>${escapeHtml(song)}</span></button></li>`).join('');
  return `<div class="statistics-note">${eventDates.length.toLocaleString('ja-JP')}件のイベント・${songs.length.toLocaleString('ja-JP')}曲を表示。凡例を選ぶと、該当する折れ線だけを表示できます。</div><div class="statistics-chart-scroll" tabindex="0" aria-label="セットリスト統計グラフ。横方向にスクロールできます。"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="楽曲別の累計披露回数"><g class="statistics-grid">${grid}</g><line class="statistics-axis" x1="${left}" x2="${width - 24}" y1="${height - bottom}" y2="${height - bottom}" />${lines}<g>${labels}</g></svg></div><ul class="statistics-legend" aria-label="楽曲の表示切替">${legend}</ul>`;
}

function bindLegend() {
  const buttons = [...chart.querySelectorAll('.statistics-legend button')];
  buttons.forEach((button) => button.addEventListener('click', () => {
    const selected = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!selected));
    const song = button.dataset.song;
    const line = chart.querySelector(`.statistics-series[data-song="${CSS.escape(song)}"]`);
    if (line) line.classList.toggle('is-hidden', selected);
  }));
}

try {
  const response = await fetch('../data/setlist-statistics.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const source = await response.json();
  const entries = (source.entries ?? []).filter((entry) => entry.date && entry.statisticSong);
  if (!entries.length) {
    heading.textContent = '統計対象のセットリストはありません';
    description.textContent = 'スプレッドシートの「統計対象」が TRUE のレコードを表示します。';
    empty.hidden = false;
  } else {
    const model = aggregate(entries);
    heading.textContent = '楽曲別・累計披露回数';
    description.textContent = '披露回数は、統計対象のセットリストを開催日時順に積み上げて表示しています。';
    chart.innerHTML = chartMarkup(model);
    chart.hidden = false;
    bindLegend();
  }
} catch (error) {
  console.error(error);
  heading.textContent = '統計情報を読み込めませんでした';
  description.textContent = '時間をおいて再読み込みしてください。';
}
