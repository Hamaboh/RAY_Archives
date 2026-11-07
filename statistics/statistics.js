const $ = (selector) => document.querySelector(selector);
const heading = $('#statistics-heading');
const description = $('#statistics-description');
const chart = $('#statistics-chart');
const empty = $('#statistics-empty');

const colors = ['#f5f5f5', '#9fc5ff', '#ffbc8b', '#a8e6c1', '#d8b4fe', '#f7a8c8', '#fbef9a', '#7dd3fc', '#fca5a5', '#c4b5fd', '#86efac', '#fcd34d', '#f0abfc', '#67e8f9', '#fdba74', '#a3e635'];
const artistOptions = ['RAY', '内山結愛', '甲斐莉乃', '白川さやか', '琴山しずく', '月海まお'];
const yearOptions = ['2019', '2020', '2021', '2022', '2023', '2024'];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);

function dateLabel(value) {
  const [date, time = ''] = value.split('T');
  const [year, month, day] = date.split('-');
  return `${year}/${Number(month)}/${Number(day)}${time ? ` ${time}` : ''}`;
}

function aggregate(entries) {
  const eventDates = [...new Set(entries.map((entry) => entry.date))].sort((first, second) => first.localeCompare(second, 'ja'));
  const songs = [...new Set(entries.map((entry) => entry.statisticSong))].sort((first, second) => first.localeCompare(second, 'ja'));
  const increments = new Map();
  entries.forEach((entry) => increments.set(`${entry.date}\u0000${entry.statisticSong}`, (increments.get(`${entry.date}\u0000${entry.statisticSong}`) ?? 0) + 1));
  const cumulative = new Map(songs.map((song) => [song, []]));
  songs.forEach((song) => {
    let count = 0;
    eventDates.forEach((date, index) => {
      const increment = increments.get(`${date}\u0000${song}`) ?? 0;
      if (!increment) return;
      count += increment;
      cumulative.get(song).push({ index, date, value: count });
    });
  });
  return { eventDates, songs, cumulative, max: Math.max(1, ...[...cumulative.values()].flatMap((points) => points.map((point) => point.value))) };
}

function filterButtonMarkup(options, type, selected) {
  return options.map((option) => `<button type="button" class="statistics-filter-tab" data-filter-type="${type}" data-filter-value="${option}" aria-pressed="${selected.has(option)}">${type === 'year' ? `${option}年` : escapeHtml(option)}</button>`).join('');
}

function filterMarkup(selectedArtists, selectedYears) {
  return `<div class="statistics-filters" aria-label="セットリスト統計の絞り込み"><div class="statistics-filter-heading"><p class="eyebrow">FILTER</p><button type="button" class="statistics-filter-clear" ${selectedArtists.size || selectedYears.size ? '' : 'disabled'}>すべて解除</button></div><section class="statistics-filter-group" aria-labelledby="statistics-artist-filter"><h3 id="statistics-artist-filter">アーティスト</h3><div class="statistics-filter-tabs" role="group" aria-label="アーティストで絞り込む">${filterButtonMarkup(artistOptions, 'artist', selectedArtists)}</div></section><section class="statistics-filter-group" aria-labelledby="statistics-year-filter"><h3 id="statistics-year-filter">時期</h3><div class="statistics-filter-tabs" role="group" aria-label="年で絞り込む">${filterButtonMarkup(yearOptions, 'year', selectedYears)}</div></section><p class="statistics-filter-copy">複数選択できます。アーティスト内・時期内は OR、両方を選択した場合は AND で絞り込みます。</p></div>`;
}

function chartMarkup(model, selectedArtists, selectedYears) {
  const { eventDates, songs, cumulative, max } = model;
  const left = 50;
  const top = 24;
  const bottom = 82;
  const height = 372;
  const pointGap = 4;
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
    const points = values.map((point) => `${x(point.index)},${y(point.value)}`).join(' ');
    const markers = values.map((point) => `<circle cx="${x(point.index)}" cy="${y(point.value)}" r="2.4"><title>${escapeHtml(`${song} / ${dateLabel(point.date)} / 累計 ${point.value}回`)}</title></circle>`).join('');
    return `<g class="statistics-series" data-song="${escapeHtml(song)}" style="--series:${color}"><polyline points="${points}" />${markers}</g>`;
  }).join('');
  const labelStep = Math.max(1, Math.ceil((eventDates.length - 1) / 10));
  const labels = eventDates.map((date, index) => (index % labelStep === 0 || index === eventDates.length - 1 ? `<text class="statistics-date" x="${x(index)}" y="${height - bottom + 21}" text-anchor="end" transform="rotate(-48 ${x(index)} ${height - bottom + 21})">${dateLabel(date)}</text>` : '')).join('');
  return `<div class="statistics-note">${eventDates.length.toLocaleString('ja-JP')}件のイベント・${songs.length.toLocaleString('ja-JP')}曲を表示。点はその楽曲を披露したイベント、線は点どうしを結んだ累計回数です。</div><div class="statistics-chart-scroll" tabindex="0" aria-label="セットリスト統計グラフ。横方向にスクロールできます。"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="楽曲別の累計披露回数"><g class="statistics-grid">${grid}</g><line class="statistics-axis" x1="${left}" x2="${width - 24}" y1="${height - bottom}" y2="${height - bottom}" />${lines}<g>${labels}</g></svg></div>${filterMarkup(selectedArtists, selectedYears)}`;
}

function filteredEntries(entries, selectedArtists, selectedYears) {
  return entries.filter((entry) => (!selectedArtists.size || selectedArtists.has(entry.artist)) && (!selectedYears.size || selectedYears.has(entry.date.slice(0, 4))));
}

function render(entries, selectedArtists, selectedYears) {
  const filtered = filteredEntries(entries, selectedArtists, selectedYears);
  if (!filtered.length) {
    heading.textContent = '条件に一致する統計対象のセットリストはありません';
    description.textContent = 'フィルター条件を変更してください。';
    chart.innerHTML = filterMarkup(selectedArtists, selectedYears);
    chart.hidden = false;
  } else {
    const model = aggregate(filtered);
    heading.textContent = '楽曲別・累計披露回数';
    description.textContent = '披露したイベントだけに点を置き、点どうしを結んで累計披露回数を表示しています。';
    chart.innerHTML = chartMarkup(model, selectedArtists, selectedYears);
    chart.hidden = false;
  }
  chart.querySelectorAll('.statistics-filter-tab').forEach((button) => button.addEventListener('click', () => {
    const target = button.dataset.filterType === 'artist' ? selectedArtists : selectedYears;
    const value = button.dataset.filterValue;
    if (target.has(value)) target.delete(value);
    else target.add(value);
    render(entries, selectedArtists, selectedYears);
  }));
  chart.querySelector('.statistics-filter-clear')?.addEventListener('click', () => {
    selectedArtists.clear();
    selectedYears.clear();
    render(entries, selectedArtists, selectedYears);
  });
}

try {
  const response = await fetch('../data/setlist-statistics.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const source = await response.json();
  const entries = (source.entries ?? []).filter((entry) => entry.date && entry.artist && entry.statisticSong);
  if (!entries.length) {
    heading.textContent = '統計対象のセットリストはありません';
    description.textContent = 'スプレッドシートの「統計対象」が TRUE のレコードを表示します。';
    empty.hidden = false;
  } else {
    render(entries, new Set(), new Set());
  }
} catch (error) {
  console.error(error);
  heading.textContent = '統計情報を読み込めませんでした';
  description.textContent = '時間をおいて再読み込みしてください。';
}
