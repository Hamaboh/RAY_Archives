const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const monthFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'long' });
const total = $('#event-total'), yearTotal = $('#year-total'), yearNav = $('#year-nav'), search = $('#event-search'), list = $('#event-list'), title = $('#results-title'), kicker = $('#results-kicker'), description = $('#results-description'), empty = $('#empty-state');
let events = [], selectedYear = 'all';

function dateLabel(event) { const date = new Date(`${event.date}${event.time ? '' : 'T00:00'}`); return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${event.time ? ` ${event.time}` : ''}`; }
function detailsMarkup(event) {
  const details = [['会場', event.venue], ['料金', event.price], ['D代', event.drink], ['出演者', event.performers], ['衣装', event.outfit], ['共演者', event.guests], ['予約特典', event.benefit]].filter(([, value]) => value && value !== '-');
  if (!details.length && !event.url) return '';
  return `<details class="event-details"><summary>詳細を見る</summary><div class="event-details-grid">${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value).replace(/,\s*/g, ',<br />')}</dd></div>`).join('')}</div>${event.url ? `<a class="event-source" href="${escapeHtml(event.url)}" target="_blank" rel="noreferrer">イベントURLを開く ↗</a>` : ''}</details>`;
}
function eventMarkup(event) {
  const status = event.status === 'cancelled' ? '<span class="event-status">中止</span>' : event.status === 'postponed' ? '<span class="event-status">延期</span>' : '';
  return `<article class="event-card"><time datetime="${escapeHtml(event.date)}"><span>${String(event.month).padStart(2, '0')}</span><strong>${String(event.day).padStart(2, '0')}</strong><small>${event.time || 'TIME N/A'}</small></time><div class="event-main"><p class="event-date">${escapeHtml(dateLabel(event))}${status}</p><h3>${escapeHtml(event.title)}</h3>${event.venue ? `<p class="event-venue">${escapeHtml(event.venue)}</p>` : ''}${detailsMarkup(event)}</div></article>`;
}
function filteredEvents() { const words = normalise(search.value).toLocaleLowerCase('ja-JP').split(' ').filter(Boolean); return events.filter((event) => { const matchedYear = words.length > 0 || selectedYear === 'all' || String(event.year) === selectedYear; const haystack = normalise([event.title, event.venue, event.performers, event.guests, event.price].join(' ')).toLocaleLowerCase('ja-JP'); return matchedYear && words.every((word) => haystack.includes(word)); }); }
function renderYears() {
  const years = [...new Set(events.map((event) => String(event.year)))].sort((a, b) => b.localeCompare(a, 'ja'));
  yearNav.innerHTML = [`<button type="button" data-year="all" aria-current="${selectedYear === 'all'}"><span>ALL</span><b>${events.length.toLocaleString('ja-JP')}</b></button>`, ...years.map((year) => `<button type="button" data-year="${year}" aria-current="${selectedYear === year}"><span>${year}</span><b>${events.filter((event) => String(event.year) === year).length.toLocaleString('ja-JP')}</b></button>`)].join('');
  yearNav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { selectedYear = button.dataset.year; renderYears(); renderEvents(); }));
}
function renderEvents() {
  const visible = filteredEvents(), query = normalise(search.value), label = selectedYear === 'all' ? '全期間' : `${selectedYear}年`, groups = new Map();
  kicker.textContent = query ? 'SEARCH RESULT / ALL YEARS' : `${label.toUpperCase()} / EVENT RECORDS`; title.textContent = query ? `「${query}」の検索結果` : `${label}のイベント`; description.textContent = `${visible.length.toLocaleString('ja-JP')}件を表示。${query ? '年の選択にかかわらず、タイトル、会場、出演者、共演者、料金を横断検索しています。' : '開催月ごとに、日付順で表示しています。'}`;
  visible.forEach((event) => { const key = `${event.year}-${String(event.month).padStart(2, '0')}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(event); });
  list.innerHTML = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a, 'ja')).map(([key, group]) => { const [year] = key.split('-'); return `<section class="event-month"><header><p>${year}</p><h3>${monthFormatter.format(new Date(`${key}-01T00:00`))}</h3><span>${group.length} EVENTS</span></header>${group.map(eventMarkup).join('')}</section>`; }).join(''); empty.hidden = visible.length !== 0;
}
try {
  const response = await fetch('../data/events.json', { cache: 'no-cache' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  events = (await response.json()).events ?? []; total.textContent = events.length.toLocaleString('ja-JP'); yearTotal.textContent = new Set(events.map((event) => event.year)).size.toLocaleString('ja-JP'); selectedYear = String(Math.max(...events.map((event) => Number(event.year)))); renderYears(); renderEvents();
  search.addEventListener('input', renderEvents); document.addEventListener('keydown', (event) => { if (event.key === '/' && document.activeElement !== search) { event.preventDefault(); search.focus(); } if (event.key === 'Escape' && document.activeElement === search) { search.value = ''; renderEvents(); } });
} catch (error) { console.error(error); title.textContent = 'イベント情報を読み込めませんでした'; description.textContent = '時間をおいて再読み込みしてください。'; }
