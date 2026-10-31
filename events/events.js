const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const inline = (value) => normalise(value).replace(/,\s+/g, ', ');
const splitValues = (value) => String(value ?? '').split(/,\s*/).map((item) => item.trim()).filter((item) => item && item !== '-');
const monthFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'long' });
const total = $('#event-total'), yearTotal = $('#year-total'), yearNav = $('#year-nav'), filterPanel = $('#event-filters'), filterStatus = $('#filter-status'), resetFilters = $('#reset-filters'), openFilters = $('#open-filters'), filterCount = $('#filter-count'), filterDialog = $('#event-filter-dialog'), closeFilters = $('#close-filters'), list = $('#event-list'), title = $('#results-title'), kicker = $('#results-kicker'), description = $('#results-description'), empty = $('#empty-state');
let events = [], selectedYear = 'all', filterLogic = 'and';

const valueFilters = [
  { key: 'venue', label: '会場', values: (event) => splitValues(event.venue) },
  { key: 'performers', label: '出演者', values: (event) => splitValues(event.performers) },
  { key: 'guests', label: '共演者', values: (event) => splitValues(event.guests) },
];
const basicFlagFilters = [
  { key: 'oneMan', label: 'ワンマンライブ', matches: (event) => event.oneMan === true },
  { key: 'twoMan', label: '2マンライブ', matches: (event) => /【2マンライブ】/.test(event.notes ?? '') },
  { key: 'threeMan', label: '3マンライブ', matches: (event) => /【3マンライブ】/.test(event.notes ?? '') },
  { key: 'collaboration', label: 'コラボ', matches: (event) => /【コラボ】/.test(event.notes ?? '') },
  { key: 'hosted', label: '主催', matches: (event) => /(?:presents|主催)/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'postponed', label: '延期', matches: (event) => event.status === 'postponed' },
  { key: 'cancelled', label: '中止', matches: (event) => event.status === 'cancelled' },
];
const specialSetFilters = [
  { key: 'specialSet', label: '特殊セット（全般）', matches: (event) => /(?:考案)?セットリスト|特殊セット|RAY Acoustic Set|RAY BAND ?SET|RAY FEEDBACK SET|RAY Percussion Set|RAYCHANZWERK SET|EXPERIMENTAL VJ SET|RAY GROOVE SET|RAY MOSH SET|RAYPHEX TWIN|RAY IDM SET/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'acousticSet', label: 'RAY Acoustic Set', matches: (event) => /RAY Acoustic Set/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'bandSet', label: 'RAY BAND SET', matches: (event) => /RAY BAND ?SET|IDOLBANDSET/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'feedbackSet', label: 'RAY FEEDBACK SET', matches: (event) => /RAY FEEDBACK SET/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'percussionSet', label: 'RAY Percussion Set', matches: (event) => /RAY Percussion Set/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'chanzwerkSet', label: 'RAYCHANZWERK SET', matches: (event) => /RAYCHANZWERK SET/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'experimentalVjSet', label: 'EXPERIMENTAL VJ SET', matches: (event) => /EXPERIMENTAL VJ SET/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'grooveSet', label: 'RAY GROOVE SET', matches: (event) => /RAY GROOVE SET/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'moshSet', label: 'RAY MOSH SET', matches: (event) => /RAY MOSH SET/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'rayphexTwin', label: 'RAYPHEX TWIN（RAY IDM SET）', matches: (event) => /RAYPHEX TWIN|RAY IDM SET/i.test(`${event.title}\n${event.notes ?? ''}`) },
];
const seriesFlagFilters = [
  { key: 'birthdayOrProduced', label: '生誕イベント / プロデュース公演', matches: (event) => /生誕|誕生|birthday|バースデー|プロデュース/i.test(event.title) },
  { key: 'extrome', label: 'エクストロメ', matches: (event) => /エクストロメ/.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'totalFeedback', label: 'Total Feedback', matches: (event) => /Total Feedback/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'predawn', label: 'PREDAWN', matches: (event) => /PREDAWN/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'neighbor', label: 'RAY presents「Neighbor?」', matches: (event) => /RAY presents「Neighbor\?/.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'relationship', label: 'RAY presents「Relationship」', matches: (event) => /RAY presents「Relationship/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'tieInReaction', label: '内山結愛 presents「tie in reaction」', matches: (event) => /tie in reaction/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'atmosphere', label: 'RAY/代代代/クロスノエシス 3WAY SPLIT『ATMOSPHERE』ALMOST TRANSPARENT', matches: (event) => /ATMOSPHERE|ALMOST TRANSPARENT/i.test(`${event.title}\n${event.notes ?? ''}`) },
  { key: 'noMyWay', label: 'RAY×BELLRING少女ハート SPLIT TOUR NO MY WAY', matches: (event) => /NO MY WAY/i.test(`${event.title}\n${event.notes ?? ''}`) },
];
const flagFilters = [...basicFlagFilters, ...seriesFlagFilters, ...specialSetFilters];
const filterState = Object.fromEntries(valueFilters.map(({ key }) => [key, new Set()]));
Object.assign(filterState, Object.fromEntries(flagFilters.map(({ key }) => [key, 'all'])));
const valueLogic = Object.fromEntries(valueFilters.map(({ key }) => [key, 'or']));
const filterOptions = {};

function notesFor(event) {
  const lines = String(event.notes ?? '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const topics = [], priceDetails = [];
  let inPriceDetails = false;
  lines.forEach((line) => {
    if (line.includes('【料金詳細】')) {
      inPriceDetails = true;
      const value = line.replace('【料金詳細】', '').trim();
      if (value) priceDetails.push(value);
      return;
    }
    if (inPriceDetails && line.startsWith('・')) { priceDetails.push(line); return; }
    inPriceDetails = false;
    topics.push(line);
  });
  return { topics, price: priceDetails.length ? priceDetails.map((value) => value.replace(/^・/, '').replace(/,\s*$/, '')).join(' / ') : event.price };
}
function topicsMarkup(event) {
  const { topics } = notesFor(event);
  if (!topics.length) return '';
  return `<section class="event-topics" aria-label="トピック"><p>TOPICS</p><ul>${topics.map((topic) => `<li>${escapeHtml(inline(topic).replace(/,\s*$/, ''))}</li>`).join('')}</ul></section>`;
}
function detailValueMarkup(label, value) {
  const prepared = label === '予約特典'
    ? normalise(value).replace(/,\s*/g, ',\n')
    : inline(value);
  return escapeHtml(prepared).replace(/\n/g, '<br />');
}
function setlistHeadingMarkup({ type, form }) {
  const kind = inline(type);
  const format = inline(form);
  const visibleFormat = format && format !== '-' && format !== 'RAY' ? format : '';
  const kindMarkup = kind && kind !== '-' ? `<span class="setlist-kind">【${escapeHtml(kind)}】</span>` : '';
  const formMarkup = visibleFormat ? `<span class="setlist-form">${escapeHtml(visibleFormat)}</span>` : '';
  return kindMarkup || formMarkup ? `<p class="setlist-type">${kindMarkup}${formMarkup}</p>` : '';
}
function setlistGroups(rows) {
  const groups = new Map();
  rows.forEach((row, index) => {
    const type = inline(row.type);
    const artist = inline(row.artist);
    const form = inline(row.form);
    const key = [type, artist, form].join('\u0000');
    if (!groups.has(key)) groups.set(key, { type, artist, form, index, tracks: [] });
    groups.get(key).tracks.push(row);
  });
  return [...groups.values()].sort((a, b) => a.index - b.index).map((group) => ({
    ...group,
    tracks: group.tracks.slice().sort((a, b) => {
      const first = Number.parseFloat(a.order), second = Number.parseFloat(b.order);
      const firstOrder = Number.isFinite(first) ? first : Number.MAX_SAFE_INTEGER;
      const secondOrder = Number.isFinite(second) ? second : Number.MAX_SAFE_INTEGER;
      return firstOrder - secondOrder;
    }),
  }));
}
function setlistMarkup(event) {
  const rows = event.setlists ?? [];
  if (!rows.length) return '';
  return `<section class="event-setlists" aria-label="セットリスト"><p class="setlist-heading">SETLIST</p>${setlistGroups(rows).map((group) => `<section class="setlist-group">${setlistHeadingMarkup(group)}<ol class="setlist-tracks">${group.tracks.map((track) => `<li>${track.order ? `<b>${escapeHtml(track.order)}</b>` : '<b aria-hidden="true">–</b>'}<span>${escapeHtml(track.song)}</span></li>`).join('')}</ol></section>`).join('')}</section>`;
}
function detailsMarkup(event) {
  const { price } = notesFor(event);
  const details = [['会場', event.venue], ['予約特典', event.benefit], ['料金', price], ['出演者', event.performers], ['衣装', event.outfit], ['共演者', event.guests]].filter(([, value]) => value && value !== '-');
  const setlist = setlistMarkup(event);
  if (!details.length && !event.url && !setlist) return '';
  return `<details class="event-details"><summary>詳細を見る</summary><div class="event-detail-content${details.length && setlist ? ' event-detail-content--with-setlist' : ''}">${details.length ? `<div class="event-details-grid">${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${detailValueMarkup(label, value)}</dd></div>`).join('')}</div>` : ''}${setlist}</div>${event.url ? `<a class="event-source" href="${escapeHtml(event.url)}" target="_blank" rel="noreferrer">イベントURLを開く ↗</a>` : ''}</details>`;
}
function performersMarkup(value) {
  const performers = splitValues(value);
  if (!performers.length) return '';
  return `<ul class="event-performers" aria-label="出演者">${performers.map((performer) => `<li>${escapeHtml(performer)}</li>`).join('')}</ul>`;
}
function eventMarkup(event) {
  const status = event.status === 'cancelled' ? '<span class="event-status">中止</span>' : event.status === 'postponed' ? '<span class="event-status">延期</span>' : '';
  const oneManClass = event.oneMan ? ' event-card--one-man' : '';
  return `<article class="event-card${oneManClass}"><time datetime="${escapeHtml(event.date)}"><span>${String(event.month).padStart(2, '0')}</span><strong>${String(event.day).padStart(2, '0')}</strong><small>${event.time || 'TIME N/A'}</small></time><div class="event-main"><h3>${escapeHtml(event.title)}${status}</h3>${event.venue ? `<p class="event-venue">${escapeHtml(event.venue)}</p>` : ''}${topicsMarkup(event)}${detailsMarkup(event)}</div><div class="event-side">${performersMarkup(event.performers)}</div></article>`;
}

function activeFilterLabels() {
  const values = valueFilters.filter(({ key }) => filterState[key].size).map(({ key, label }) => filterState[key].size > 1 ? `${label}（${valueLogic[key].toUpperCase()}）` : label);
  const flags = flagFilters.filter(({ key }) => filterState[key] !== 'all').map(({ label }) => label);
  return [...values, ...flags];
}
function eventMatchesFilters(event) {
  const conditions = valueFilters.flatMap(({ key, values }) => {
    const selected = filterState[key];
    if (!selected.size) return [];
    const eventValues = values(event);
    return [valueLogic[key] === 'and' ? [...selected].every((value) => eventValues.includes(value)) : eventValues.some((value) => selected.has(value))];
  }).concat(flagFilters.flatMap(({ key, matches }) => {
    const selection = filterState[key];
    return selection === 'all' ? [] : [selection === 'true' ? matches(event) : !matches(event)];
  }));
  return !conditions.length || (filterLogic === 'and' ? conditions.every(Boolean) : conditions.some(Boolean));
}
function statusIsVisible(event) {
  if (event.status === 'postponed') return filterState.postponed === 'true';
  if (event.status === 'cancelled') return filterState.cancelled === 'true';
  return true;
}
function isRegularEvent(event) {
  return event.status !== 'postponed' && event.status !== 'cancelled';
}
function filteredEvents() {
  return events.filter((event) => (selectedYear === 'all' || String(event.year) === selectedYear) && statusIsVisible(event) && eventMatchesFilters(event));
}
function filterSummary(key) {
  const count = filterState[key].size;
  return count ? `${count}件選択` : 'すべて';
}
function renderValueOptions(key, query = '') {
  const container = filterPanel.querySelector(`[data-options="${key}"]`);
  if (!container) return;
  const selected = filterState[key];
  const options = filterOptions[key] ?? [];
  const normalizedQuery = normalise(query).toLocaleLowerCase('ja-JP');
  const matches = options.filter((value) => value.toLocaleLowerCase('ja-JP').includes(normalizedQuery));
  const ordered = [...selected].sort((a, b) => a.localeCompare(b, 'ja')).concat(matches.filter((value) => !selected.has(value)));
  const visible = ordered.slice(0, 100);
  container.innerHTML = `${visible.map((value) => `<label class="filter-option"><input type="checkbox" aria-label="${escapeHtml(value)}" data-value-filter="${key}" value="${escapeHtml(value)}"${selected.has(value) ? ' checked' : ''} /><span>${escapeHtml(value)}</span></label>`).join('')}${ordered.length > visible.length ? `<p class="filter-more">候補が多いため、入力して絞り込んでください（${matches.length.toLocaleString('ja-JP')}件）。</p>` : ''}` || '<p class="filter-more">一致する項目はありません。</p>';
}
function updateFilterChrome() {
  valueFilters.forEach(({ key }) => {
    const summary = filterPanel.querySelector(`[data-filter-summary="${key}"]`);
    if (summary) summary.textContent = filterSummary(key);
  });
  const active = activeFilterLabels();
  const logicLabel = filterLogic === 'and' ? 'すべてに一致（AND）' : 'いずれかに一致（OR）';
  filterStatus.textContent = active.length ? `${active.length}項目で絞り込み中：${logicLabel}` : '条件を選択して絞り込み';
  resetFilters.hidden = !active.length;
  filterCount.textContent = active.length ? `${active.length}項目・${filterLogic.toUpperCase()}` : '条件を選択';
}
function valueFilterMarkup({ key, label }) {
  return `<details class="event-filter"><summary><span>${label}</span><b data-filter-summary="${key}">すべて</b></summary><div class="event-filter-menu"><label class="filter-value-logic"><span>複数選択時</span><select data-value-logic="${key}" aria-label="${label}の複数選択条件"><option value="or"${valueLogic[key] === 'or' ? ' selected' : ''}>いずれか（OR）</option><option value="and"${valueLogic[key] === 'and' ? ' selected' : ''}>すべて（AND）</option></select></label><label class="filter-search"><span class="visually-hidden">${label}を絞り込む</span><input type="search" data-value-search="${key}" placeholder="${label}を入力して絞り込む" autocomplete="off" /></label><div class="filter-options" data-options="${key}"></div></div></details>`;
}
function flagFilterMarkup({ key, label }) {
  const isStatusFilter = key === 'postponed' || key === 'cancelled';
  return `<label class="event-flag"><span>${label}</span><select data-flag-filter="${key}" aria-label="${label}の条件"><option value="all">${isStatusFilter ? '非表示（初期設定）' : 'すべて'}</option><option value="true">TRUE</option><option value="false">FALSE</option></select></label>`;
}
function filterCategoryMarkup(kicker, title, content, className = '') {
  return `<section class="filter-category ${className}"><header><p>${kicker}</p><h3>${title}</h3></header><div class="event-filters">${content}</div></section>`;
}
function filterLogicMarkup() {
  return `<section class="filter-logic-group"><div><p>CONDITION GROUP</p><h3>条件のつなぎ方</h3><span>異なる項目どうしの一致条件を選択</span></div><label><span class="visually-hidden">条件のつなぎ方</span><select data-filter-logic aria-label="条件のつなぎ方"><option value="and"${filterLogic === 'and' ? ' selected' : ''}>すべてに一致（AND）</option><option value="or"${filterLogic === 'or' ? ' selected' : ''}>いずれかに一致（OR）</option></select></label></section>`;
}
function renderFilters() {
  valueFilters.forEach(({ key, values }) => { filterOptions[key] = [...new Set(events.flatMap(values))].sort((a, b) => a.localeCompare(b, 'ja')); });
  filterPanel.innerHTML = [
    filterLogicMarkup(),
    filterCategoryMarkup('BASIC', '基本条件', `${valueFilters.map(valueFilterMarkup).join('')}${basicFlagFilters.map(flagFilterMarkup).join('')}`),
    filterCategoryMarkup('EVENT TYPES & SERIES', '企画・シリーズ', seriesFlagFilters.map(flagFilterMarkup).join('')),
    filterCategoryMarkup('SPECIAL SETS', '特殊セット', specialSetFilters.map(flagFilterMarkup).join(''), 'filter-category--sets'),
  ].join('');
  valueFilters.forEach(({ key }) => renderValueOptions(key));
  updateFilterChrome();
}
function clearFilters() {
  valueFilters.forEach(({ key }) => filterState[key].clear());
  flagFilters.forEach(({ key }) => { filterState[key] = 'all'; });
  valueFilters.forEach(({ key }) => { valueLogic[key] = 'or'; });
  filterLogic = 'and';
  filterPanel.querySelectorAll('input[data-value-search]').forEach((input) => { input.value = ''; });
  filterPanel.querySelectorAll('select[data-flag-filter]').forEach((select) => { select.value = 'all'; });
  filterPanel.querySelectorAll('select[data-value-logic]').forEach((select) => { select.value = 'or'; });
  filterPanel.querySelector('select[data-filter-logic]').value = 'and';
  valueFilters.forEach(({ key }) => renderValueOptions(key));
  updateFilterChrome();
  renderEvents();
}
function bindFilters() {
  filterPanel.addEventListener('input', (event) => {
    const input = event.target;
    if (input.matches('input[data-value-search]')) renderValueOptions(input.dataset.valueSearch, input.value);
  });
  filterPanel.addEventListener('change', (event) => {
    const input = event.target;
    if (input.matches('input[data-value-filter]')) {
      const selected = filterState[input.dataset.valueFilter];
      input.checked ? selected.add(input.value) : selected.delete(input.value);
      updateFilterChrome();
      renderEvents();
    }
    if (input.matches('select[data-flag-filter]')) {
      filterState[input.dataset.flagFilter] = input.value;
      updateFilterChrome();
      renderEvents();
    }
    if (input.matches('select[data-value-logic]')) {
      valueLogic[input.dataset.valueLogic] = input.value;
      updateFilterChrome();
      renderEvents();
    }
    if (input.matches('select[data-filter-logic]')) {
      filterLogic = input.value;
      updateFilterChrome();
      renderEvents();
    }
  });
  resetFilters.addEventListener('click', clearFilters);
  openFilters.addEventListener('click', () => filterDialog.showModal());
  closeFilters.addEventListener('click', () => filterDialog.close());
}
function renderYears() {
  const years = [...new Set(events.map((event) => String(event.year)))].sort((a, b) => a.localeCompare(b, 'ja'));
  const regularEvents = events.filter(isRegularEvent);
  yearNav.innerHTML = [`<button type="button" data-year="all" aria-current="${selectedYear === 'all'}"><span>すべてのイベント出演情報</span><b>${regularEvents.length.toLocaleString('ja-JP')}</b></button>`, ...years.map((year) => `<button type="button" data-year="${year}" aria-current="${selectedYear === year}"><span>${year}</span><b>${regularEvents.filter((event) => String(event.year) === year).length.toLocaleString('ja-JP')}</b></button>`)].join('');
  yearNav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { selectedYear = button.dataset.year; renderYears(); renderEvents(); }));
}
function renderEvents() {
  const visible = filteredEvents(), active = activeFilterLabels(), label = selectedYear === 'all' ? '全期間' : `${selectedYear}年`, groups = new Map();
  kicker.textContent = active.length ? 'FILTERED EVENT RECORDS' : `${label.toUpperCase()} / EVENT RECORDS`;
  title.textContent = active.length ? `${label}の絞り込み結果` : `${label}のイベント`;
  description.textContent = `${visible.length.toLocaleString('ja-JP')}件を表示。${active.length ? `「${active.join('・')}」を${filterLogic === 'and' ? 'すべて満たす（AND）' : 'いずれかを満たす（OR）'}条件で絞り込んでいます。` : '開催月ごとに、日付順で表示しています。'}`;
  visible.forEach((event) => { const key = `${event.year}-${String(event.month).padStart(2, '0')}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(event); });
  list.innerHTML = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'ja')).map(([key, group]) => { const [year] = key.split('-'); return `<section class="event-month"><header><p>${year}</p><h3>${monthFormatter.format(new Date(`${key}-01T00:00`))}</h3><span>${group.length} EVENTS</span></header><div class="event-records">${group.map(eventMarkup).join('')}</div></section>`; }).join('');
  empty.hidden = visible.length !== 0;
}

try {
  const response = await fetch('../data/events.json', { cache: 'no-cache' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  events = (await response.json()).events ?? [];
  total.textContent = events.length.toLocaleString('ja-JP');
  yearTotal.textContent = new Set(events.map((event) => event.year)).size.toLocaleString('ja-JP');
  selectedYear = 'all';
  renderFilters();
  bindFilters();
  renderYears();
  renderEvents();
} catch (error) { console.error(error); title.textContent = 'イベント情報を読み込めませんでした'; description.textContent = '時間をおいて再読み込みしてください。'; }
