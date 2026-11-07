const $ = (selector) => document.querySelector(selector);
const heading = $('#statistics-heading');
const description = $('#statistics-description');
const chart = $('#statistics-chart');
const empty = $('#statistics-empty');
let rerenderForViewport = () => {};
let resizeTimer;

const colors = ['#f5f5f5', '#9fc5ff', '#ffbc8b', '#a8e6c1', '#d8b4fe', '#f7a8c8', '#fbef9a', '#7dd3fc', '#fca5a5', '#c4b5fd', '#86efac', '#fcd34d', '#f0abfc', '#67e8f9', '#fdba74', '#a3e635'];
const artistOptions = ['RAY', '内山結愛', '甲斐莉乃', '白川さやか', '琴山しずく', '月海まお'];
const formOrder = ['RAY', 'RAY Acoustic Set', 'RAY BAND SET', 'RAY FEEDBACK SET', 'RAY Percussion Set', 'DJ RAYちゃんず', 'RAYCHANZWERK SET', 'EXPERIMENTAL VJ SET', 'RAY GROOVE SET', 'RAY MOSH SET', 'RAYPHEX TWIN（RAY IDM SET）', '内山結愛', '内山結愛弾き語り', '内山結愛 Acoustic Set', 'DJ内山結愛', '甲斐莉乃', '甲斐莉乃生誕バンド', '白川さやか', '琴山しずく', '琴山しずく弾き語り', '琴山しずく生誕バンド「コットリアン」', 'DJ琴山しずく', '琴山しずく TECHNO SET', 'hypermoshkotto', '月海まお', '月海まお弾き語り', 'DJ月海まお', '月海まお NOISE SET', '紬実詩', '紬実詩 Acoustic Set', 'DJ紬実詩', 'DJ酸辣湯麺', '月日', '愛海', 'のうまらいず'];
const regimeOptions = [
  { value: '2019-05-01', label: '2019年5月1日〜（内山結愛, 甲斐莉乃, 白川さやか, 月日）' },
  { value: '2021-02-23', label: '2021年2月23日〜（内山結愛, 甲斐莉乃, 月日）' },
  { value: '2021-07-03', label: '2021年7月3日〜（内山結愛, 甲斐莉乃, 琴山しずく, 月日）' },
  { value: '2022-07-24', label: '2022年7月24日〜（内山結愛, 琴山しずく）' },
  { value: '2022-09-19', label: '2022年9月19日〜（愛海, 内山結愛, 琴山しずく, 月海まお, 紬実詩）' },
  { value: '2025-05-05', label: '2025年5月5日〜（内山結愛, 琴山しずく, 月海まお, 紬実詩）' },
  { value: '2025-12-30', label: '2025年12月30日〜（内山結愛, 琴山しずく, 月海まお, 紬実詩, 春音友希）' },
  { value: '2026-09-24', label: '2026年9月24日〜（内山結愛, 月海まお, 紬実詩, 春音友希）' },
];
const julyThreePersonSongs = new Set(['わたし夜に泳ぐの', 'バタフライエフェクト', 'スライド', 'ネモフィラ', 'レジグナチオン', 'サテライト', '愛はどこいったの？', 'サイン', '17', 'GENERATION', 'オールニードイズラブ', 'コハルヒ']);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const correctedArtist = (entry) => (
  entry.date === '2021-02-23T17:00' && entry.song === 'ダイヤモンドリリー'
    ? '白川さやか'
    : entry.artist
);

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
    cumulative.get(song).push({ index: 0, date: eventDates[0], value: 0, performed: false });
    eventDates.forEach((date, index) => {
      const increment = increments.get(`${date}\u0000${song}`) ?? 0;
      count += increment;
      cumulative.get(song).push({ index, date, value: count, performed: increment > 0 });
    });
  });
  return { eventDates, songs, cumulative, max: Math.max(1, ...[...cumulative.values()].flatMap((points) => points.map((point) => point.value))) };
}

function filterButtonMarkup(options, type, selected) {
  return options.map((option) => `<button type="button" class="statistics-filter-tab" data-filter-type="${type}" data-filter-value="${escapeHtml(option)}" aria-pressed="${selected.has(option)}">${type === 'year' ? `${option}年` : escapeHtml(option)}</button>`).join('');
}

function formOptions(entries) {
  const available = new Set(entries.map((entry) => entry.form).filter((form) => form && form !== '-'));
  return [...available].sort((first, second) => {
    const firstIndex = formOrder.indexOf(first);
    const secondIndex = formOrder.indexOf(second);
    return (firstIndex < 0 ? Number.MAX_SAFE_INTEGER : firstIndex) - (secondIndex < 0 ? Number.MAX_SAFE_INTEGER : secondIndex) || first.localeCompare(second, 'ja');
  });
}

function yearOptions(entries) {
  const firstYear = 2019;
  const latestDataYear = Math.max(firstYear, ...entries.map((entry) => Number(entry.date.slice(0, 4))).filter(Number.isFinite));
  const lastYear = Math.max(new Date().getFullYear(), latestDataYear);
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(firstYear + index));
}

function filterMarkup(selectedArtists, selectedForm, selectedRegime, selectedYears, forms, years) {
  const selectedCount = selectedArtists.size || selectedForm || selectedRegime || selectedYears.size;
  return `<div class="statistics-filters" aria-label="セットリスト統計の絞り込み"><div class="statistics-filter-heading"><p class="eyebrow">FILTER</p><button type="button" class="statistics-filter-clear" ${selectedCount ? '' : 'disabled'}>すべて解除</button></div><section class="statistics-filter-group" aria-labelledby="statistics-artist-filter"><h3 id="statistics-artist-filter">アーティスト</h3><div class="statistics-filter-tabs" role="group" aria-label="アーティストで絞り込む">${filterButtonMarkup(artistOptions, 'artist', selectedArtists)}</div></section><section class="statistics-filter-group" aria-labelledby="statistics-form-filter"><h3 id="statistics-form-filter">形態</h3><select class="statistics-form-select" aria-labelledby="statistics-form-filter"><option value="">すべての形態</option>${forms.map((form) => `<option value="${escapeHtml(form)}" ${form === selectedForm ? 'selected' : ''}>${escapeHtml(form)}</option>`).join('')}</select></section><section class="statistics-filter-group" aria-labelledby="statistics-regime-filter"><h3 id="statistics-regime-filter">体制</h3><select class="statistics-form-select statistics-regime-select" aria-labelledby="statistics-regime-filter"><option value="">すべての体制</option>${regimeOptions.map(({ value, label }) => `<option value="${value}" ${value === selectedRegime ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></section><section class="statistics-filter-group" aria-labelledby="statistics-year-filter"><h3 id="statistics-year-filter">時期</h3><div class="statistics-filter-tabs" role="group" aria-label="年で絞り込む">${filterButtonMarkup(years, 'year', selectedYears)}</div></section><p class="statistics-filter-copy">アーティスト内・時期内は複数選択できます。形態と体制は1件のみ選択でき、異なる分類を同時に選んだ場合は AND で絞り込みます。</p></div>`;
}

function artistTables(entries) {
  const counts = new Map();
  entries.forEach(({ artist, statisticSong }) => {
    const key = `${artist}\u0000${statisticSong}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const artists = [...new Set(entries.map(({ artist }) => artist))].sort((first, second) => {
    const firstIndex = artistOptions.indexOf(first);
    const secondIndex = artistOptions.indexOf(second);
    return (firstIndex < 0 ? Number.MAX_SAFE_INTEGER : firstIndex) - (secondIndex < 0 ? Number.MAX_SAFE_INTEGER : secondIndex) || first.localeCompare(second, 'ja');
  });
  return artists.map((artist) => ({
    artist,
    rows: [...counts.entries()]
      .filter(([key]) => key.startsWith(`${artist}\u0000`))
      .map(([key, count]) => ({ song: key.slice(artist.length + 1), count }))
      .sort((first, second) => second.count - first.count || first.song.localeCompare(second.song, 'ja')),
  }));
}

function tableMarkup(entries) {
  const tables = artistTables(entries);
  return `<section class="statistics-table-section" aria-labelledby="statistics-table-heading"><div class="statistics-table-heading"><p class="eyebrow">TABLE</p><h3 id="statistics-table-heading">出演者別・表示中の披露回数</h3></div><div class="statistics-table-groups">${tables.map(({ artist, rows }) => `<section class="statistics-artist-table" aria-labelledby="statistics-table-${escapeHtml(artist)}"><h4 id="statistics-table-${escapeHtml(artist)}">${escapeHtml(artist)}</h4><div class="statistics-table-scroll"><table><thead><tr><th scope="col">楽曲名</th><th scope="col">披露回数</th></tr></thead><tbody>${rows.map(({ song, count }) => `<tr><td>${escapeHtml(song)}</td><td>${count.toLocaleString('ja-JP')}回</td></tr>`).join('')}</tbody></table></div></section>`).join('')}</div></section>`;
}

function chartMarkup(model, entries, selectedArtists, selectedForm, selectedRegime, selectedYears, forms, years) {
  const { eventDates, songs, cumulative, max } = model;
  const left = 50;
  const top = 30;
  const bottom = 82;
  const graphHeight = Math.min(760, Math.max(460, max * 1.55));
  const height = top + graphHeight + bottom;
  const pointGap = 4;
  const viewportWidth = Math.max(320, window.innerWidth || 840);
  const minimumWidth = Math.max(320, Math.min(960, viewportWidth - 40));
  const width = Math.max(minimumWidth, left + 24 + Math.max(0, eventDates.length - 1) * pointGap + 45);
  const x = (index) => eventDates.length === 1 ? width - 24 : left + index * ((width - left - 24) / (eventDates.length - 1));
  const y = (value) => top + graphHeight - (value / max) * graphHeight;
  const tickCount = Math.max(2, Math.min(max, 8, Math.floor(graphHeight / 105)));
  const ticks = [...new Set([...Array(tickCount + 1)].map((_, index) => Math.round((max / tickCount) * index)))].sort((first, second) => first - second);
  const grid = ticks.map((value) => `<g><line x1="${left}" x2="${width - 24}" y1="${y(value)}" y2="${y(value)}" /><text x="${left - 9}" y="${y(value) + 4}" text-anchor="end">${value}</text></g>`).join('');
  const lines = songs.map((song, songIndex) => {
    const values = cumulative.get(song);
    const color = colors[songIndex % colors.length];
    const points = values.map((point) => `${x(point.index)},${y(point.value)}`).join(' ');
    const markers = values.filter((point) => point.performed).map((point) => `<circle cx="${x(point.index)}" cy="${y(point.value)}" r="2.4"><title>${escapeHtml(`${song} / ${dateLabel(point.date)} / 累計 ${point.value}回`)}</title></circle>`).join('');
    return `<g class="statistics-series" data-song="${escapeHtml(song)}" data-counts="${values.map((point) => point.value).join(',')}" style="--series:${color}"><polyline class="statistics-series-hit" points="${points}" /><polyline class="statistics-series-line" points="${points}" />${markers}</g>`;
  }).join('');
  const labelPitch = 76;
  const maximumLabelCount = Math.max(2, Math.floor((width - left - 24) / labelPitch) + 1);
  const labelStep = eventDates.length <= 1 ? 1 : Math.max(1, Math.ceil((eventDates.length - 1) / (maximumLabelCount - 1)));
  const labels = eventDates.map((date, index) => (index % labelStep === 0 || index === eventDates.length - 1 ? `<text class="statistics-date" x="${x(index)}" y="${height - bottom + 21}" text-anchor="end" transform="rotate(-48 ${x(index)} ${height - bottom + 21})">${dateLabel(date)}</text>` : '')).join('');
  return `<div class="statistics-note">${eventDates.length.toLocaleString('ja-JP')}件のイベント・${songs.length.toLocaleString('ja-JP')}曲を表示。各楽曲は原点から開始し、披露前はx軸上を進みます。点は披露したイベント、線は累計回数です。</div><div class="statistics-chart-scroll" tabindex="0" aria-label="セットリスト統計グラフ。横方向にスクロールできます。"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="楽曲別の累計披露回数"><g class="statistics-grid">${grid}</g><line class="statistics-axis" x1="${left}" x2="${width - 24}" y1="${height - bottom}" y2="${height - bottom}" />${lines}<g>${labels}</g></svg><div class="statistics-tooltip" role="status" hidden></div></div>${filterMarkup(selectedArtists, selectedForm, selectedRegime, selectedYears, forms, years)}${tableMarkup(entries)}`;
}

function bindChartTooltip() {
  const scroll = chart.querySelector('.statistics-chart-scroll');
  const tooltip = chart.querySelector('.statistics-tooltip');
  const svg = scroll?.querySelector('svg');
  if (!scroll || !tooltip || !svg) return;
  const distanceToSegment = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const denominator = dx * dx + dy * dy;
    const ratio = denominator ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator)) : 0;
    return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
  };
  const seriesGeometry = [...chart.querySelectorAll('.statistics-series')].map((series) => ({
    song: series.dataset.song,
    counts: (series.dataset.counts ?? '').split(',').map(Number),
    points: [...(series.querySelector('.statistics-series-line')?.points ?? [])].map(({ x, y }) => ({ x, y })),
  }));
  const songsAtPointer = (event) => {
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const point = { x: viewBox.x + (event.clientX - rect.left) * (viewBox.width / rect.width), y: viewBox.y + (event.clientY - rect.top) * (viewBox.height / rect.height) };
    const tolerance = 7 * Math.max(viewBox.width / rect.width, viewBox.height / rect.height);
    return seriesGeometry.filter(({ points }) => {
      if (!points.length) return false;
      if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= tolerance;
      return points.slice(1).some((end, index) => distanceToSegment(point, points[index], end) <= tolerance);
    }).map(({ song, counts, points }) => {
      const nearestIndex = points.reduce((nearest, candidate, index) => Math.abs(candidate.x - point.x) < Math.abs(points[nearest].x - point.x) ? index : nearest, 0);
      return { song, count: counts[nearestIndex] ?? 0 };
    }).filter(({ song, count }) => song && count > 0);
  };
  const positionTooltip = (event) => {
    const bounds = scroll.getBoundingClientRect();
    const minimumLeft = scroll.scrollLeft + 10;
    const maximumLeft = scroll.scrollLeft + bounds.width - tooltip.offsetWidth - 10;
    const cursorLeft = event.clientX - bounds.left + scroll.scrollLeft;
    const rightAligned = cursorLeft + 12;
    const leftAligned = cursorLeft - tooltip.offsetWidth - 12;
    const left = maximumLeft >= minimumLeft ? Math.max(minimumLeft, Math.min(maximumLeft, rightAligned > maximumLeft ? leftAligned : rightAligned)) : minimumLeft;
    const top = Math.max(10, event.clientY - bounds.top - tooltip.offsetHeight - 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };
  const show = (event) => {
    const songs = songsAtPointer(event);
    const fallbackSong = event.currentTarget.closest('.statistics-series')?.dataset.song;
    tooltip.textContent = (songs.length ? songs : fallbackSong ? [{ song: fallbackSong, count: 0 }] : []).map(({ song, count }) => `${song}（${count.toLocaleString('ja-JP')}回）`).join(',\n');
    tooltip.hidden = false;
    positionTooltip(event);
  };
  chart.querySelectorAll('.statistics-series-hit, .statistics-series circle').forEach((target) => {
    target.addEventListener('pointerenter', show);
    target.addEventListener('pointermove', show);
    target.addEventListener('pointerleave', () => { tooltip.hidden = true; });
  });
}

function regimeFor(entry) {
  if (entry.date < '2021-02-23') return '2019-05-01';
  if (entry.date === '2021-02-23T17:00') {
    if (entry.type) return entry.type.includes('Encore') ? '2021-02-23' : '2019-05-01';
    return entry.song === 'バタフライエフェクト' || (entry.song === '世界の終わりは君とふたりで' && entry.boundaryOccurrence > 1) ? '2021-02-23' : '2019-05-01';
  }
  if (entry.date < '2021-07-03') return '2021-02-23';
  if (entry.date === '2021-07-03T15:00') {
    if (entry.type) return entry.type.startsWith('1. 本編') && Number(entry.order) <= 12 ? '2021-02-23' : '2021-07-03';
    return julyThreePersonSongs.has(entry.song) && !(entry.song === 'バタフライエフェクト' && entry.boundaryOccurrence > 1) ? '2021-02-23' : '2021-07-03';
  }
  return [...regimeOptions].reverse().find(({ value }) => entry.date >= value)?.value ?? '';
}

function withBoundaryOccurrences(entries) {
  const occurrences = new Map();
  return entries.map((entry) => {
    const key = `${entry.date}\u0000${entry.song}`;
    const boundaryOccurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, boundaryOccurrence);
    return { ...entry, boundaryOccurrence };
  });
}

function filteredEntries(entries, selectedArtists, selectedForm, selectedRegime, selectedYears) {
  return entries.filter((entry) => (!selectedArtists.size || selectedArtists.has(entry.artist)) && (!selectedForm || entry.form === selectedForm) && (!selectedRegime || regimeFor(entry) === selectedRegime) && (!selectedYears.size || selectedYears.has(entry.date.slice(0, 4))));
}

function render(entries, selectedArtists, selectedForm, selectedRegime, selectedYears) {
  rerenderForViewport = () => render(entries, selectedArtists, selectedForm, selectedRegime, selectedYears);
  const forms = formOptions(entries);
  const years = yearOptions(entries);
  const filtered = filteredEntries(entries, selectedArtists, selectedForm, selectedRegime, selectedYears);
  if (!filtered.length) {
    heading.textContent = '条件に一致する統計対象のセットリストはありません';
    description.textContent = 'フィルター条件を変更してください。';
    chart.innerHTML = filterMarkup(selectedArtists, selectedForm, selectedRegime, selectedYears, forms, years);
    chart.hidden = false;
  } else {
    const model = aggregate(filtered);
    heading.textContent = '楽曲別・累計披露回数';
    description.textContent = '各楽曲は原点から開始し、披露前はx軸上を進みます。披露したイベントに点を置き、累計披露回数を表示しています。';
    chart.innerHTML = chartMarkup(model, filtered, selectedArtists, selectedForm, selectedRegime, selectedYears, forms, years);
    chart.hidden = false;
    bindChartTooltip();
  }
  chart.querySelectorAll('.statistics-filter-tab').forEach((button) => button.addEventListener('click', () => {
    const target = button.dataset.filterType === 'artist' ? selectedArtists : selectedYears;
    const value = button.dataset.filterValue;
    if (target.has(value)) target.delete(value);
    else target.add(value);
    render(entries, selectedArtists, selectedForm, selectedRegime, selectedYears);
  }));
  chart.querySelector('.statistics-form-select')?.addEventListener('change', (event) => {
    selectedForm = event.target.value;
    render(entries, selectedArtists, selectedForm, selectedRegime, selectedYears);
  });
  chart.querySelector('.statistics-regime-select')?.addEventListener('change', (event) => {
    selectedRegime = event.target.value;
    render(entries, selectedArtists, selectedForm, selectedRegime, selectedYears);
  });
  chart.querySelector('.statistics-filter-clear')?.addEventListener('click', () => {
    selectedArtists.clear();
    selectedForm = '';
    selectedRegime = '';
    selectedYears.clear();
    render(entries, selectedArtists, selectedForm, selectedRegime, selectedYears);
  });
}

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(rerenderForViewport, 120);
});

try {
  const response = await fetch('../data/setlist-statistics.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const source = await response.json();
  const entries = withBoundaryOccurrences((source.entries ?? [])
    .map((entry) => ({ ...entry, artist: correctedArtist(entry) }))
    .filter((entry) => entry.date && entry.artist && entry.form && entry.statisticSong));
  if (!entries.length) {
    heading.textContent = '統計対象のセットリストはありません';
    description.textContent = 'スプレッドシートの「統計対象」が TRUE のレコードを表示します。';
    empty.hidden = false;
  } else {
    render(entries, new Set(), '', '', new Set());
  }
} catch (error) {
  console.error(error);
  heading.textContent = '統計情報を読み込めませんでした';
  description.textContent = '時間をおいて再読み込みしてください。';
}
