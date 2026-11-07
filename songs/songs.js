const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const isValue = (value) => Boolean(normalise(value)) && normalise(value) !== '-';
const dateLabel = document.body.dataset.dateLabel || '初披露日';
const creditSearchLabel = document.body.dataset.creditSearchLabel || 'クレジット';
const creditSearchPlaceholder = document.body.dataset.creditSearchPlaceholder || '原曲・作詞・作曲・編曲・振付を検索';
const humanDate = (song) => song.year ? `${song.year}年${String(song.month).padStart(2, '0')}月${String(song.day).padStart(2, '0')}日${song.time ? ` ${song.time}` : ''}` : `${dateLabel}未登録`;
const search = $('#song-search');
const searchScopeButtons = [...document.querySelectorAll('[data-search-scope]')];
const artistFilter = $('#artist-filter');
const typeFilter = $('#type-filter');
const total = $('#song-total');
const artistTotal = $('#artist-total');
const formTotal = $('#form-total');
const status = $('#song-filter-status');
const title = $('#song-results-title');
const description = $('#song-results-description');
const list = $('#song-list');
const empty = $('#song-empty');
let songs = [];
let searchScope = 'title';

const artistOrder = ['RAY', '内山結愛', '甲斐莉乃', '白川さやか', '琴山しずく', '月海まお', 'RAY, BELLRING少女ハート', 'のうまらいず'];
const typeOrder = ['オリジナル', 'カバー', 'アレンジ'];

function optionMarkup(value) { return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`; }
function isSame(value, filter) { return !filter || value === filter; }
function orderedValues(values, preferredOrder) {
  const available = new Set(values);
  return [...preferredOrder.filter((value) => available.has(value)), ...values.filter((value) => !preferredOrder.includes(value)).sort((first, second) => first.localeCompare(second, 'ja'))];
}
function updateSearchScope() {
  const isTitle = searchScope === 'title';
  search.placeholder = isTitle ? '楽曲名を検索' : creditSearchPlaceholder;
  searchScopeButtons.forEach((button) => {
    const selected = button.dataset.searchScope === searchScope;
    button.setAttribute('aria-pressed', String(selected));
  });
}
function creditsMarkup(song) {
  const credits = [
    ['原曲アーティスト', song.originalArtist],
    ['作詞', song.lyrics],
    ['作曲', song.composition],
    ['編曲', song.arrangement],
    ['振付', song.choreography],
    ['アレンジver.', song.alternateVersion],
  ].filter(([, value]) => isValue(value));
  if (!credits.length) return '';
  return `<details class="song-credits"><summary>クレジットを見る</summary><dl>${credits.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></details>`;
}
function songMarkup(song) {
  // RAY単独の披露も、活動形態として明示する。
  const form = song.form === 'RAY' || song.form !== song.artist ? song.form : '';
  return `<article class="song-card"><div class="song-card-main"><p class="song-date">${escapeHtml(humanDate(song))}</p><h3>${escapeHtml(song.title)}</h3><dl class="song-meta"><div><dt>種別</dt><dd>${escapeHtml(song.type || '—')}</dd></div>${form ? `<div><dt>活動形態</dt><dd>${escapeHtml(form)}</dd></div>` : ''}</dl></div>${creditsMarkup(song)}</article>`;
}
function filteredSongs() {
  const query = normalise(search.value).toLocaleLowerCase('ja-JP');
  return songs.filter((song) => {
    const searchable = (searchScope === 'title' ? [song.title] : [song.originalArtist, song.lyrics, song.composition, song.arrangement, song.choreography, song.alternateVersion]).join(' ').toLocaleLowerCase('ja-JP');
    return (!query || searchable.includes(query)) && isSame(song.artist, artistFilter.value) && isSame(song.type, typeFilter.value);
  });
}
function renderSongs() {
  const visible = filteredSongs();
  const active = [normalise(search.value) ? `${searchScope === 'title' ? '楽曲名' : creditSearchLabel}:「${normalise(search.value)}」` : '', artistFilter.value, typeFilter.value].filter(Boolean);
  title.textContent = active.length ? '絞り込み結果' : 'すべての楽曲';
  description.textContent = `${visible.length.toLocaleString('ja-JP')}曲を表示${active.length ? `：${active.join('・')}` : `。アーティスト別・${dateLabel}順に表示しています。`}`;
  status.textContent = active.length ? `${active.length}項目で絞り込み中` : 'すべての楽曲を表示';
  const artists = new Map();
  visible.forEach((song) => {
    const key = isValue(song.artist) ? song.artist : 'アーティスト未登録';
    if (!artists.has(key)) artists.set(key, []);
    artists.get(key).push(song);
  });
  list.innerHTML = [...artists.entries()].sort(([first], [second]) => first === 'アーティスト未登録' ? 1 : second === 'アーティスト未登録' ? -1 : first.localeCompare(second, 'ja')).map(([artist, entries]) => `<section class="song-artist"><header><h3>${escapeHtml(artist)}</h3><span>${entries.length} SONGS</span></header><div class="song-cards">${entries.map(songMarkup).join('')}</div></section>`).join('');
  empty.hidden = visible.length !== 0;
}
function initialise() {
  const artists = orderedValues([...new Set(songs.map((song) => song.artist).filter(isValue))], artistOrder);
  const types = orderedValues([...new Set(songs.map((song) => song.type).filter(isValue))], typeOrder);
  artistFilter.insertAdjacentHTML('beforeend', artists.map(optionMarkup).join(''));
  typeFilter.insertAdjacentHTML('beforeend', types.map(optionMarkup).join(''));
  total.textContent = songs.length.toLocaleString('ja-JP');
  artistTotal.textContent = artists.length.toLocaleString('ja-JP');
  formTotal.textContent = new Set(songs.map((song) => song.form).filter(isValue)).size.toLocaleString('ja-JP');
  [search, artistFilter, typeFilter].forEach((input) => input.addEventListener(input === search ? 'input' : 'change', renderSongs));
  searchScopeButtons.forEach((button) => button.addEventListener('click', () => {
    searchScope = button.dataset.searchScope;
    updateSearchScope();
    renderSongs();
    search.focus();
  }));
  updateSearchScope();
  renderSongs();
}

try {
  const response = await fetch(document.body.dataset.songSource || '../data/songs.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  songs = ((await response.json()).songs ?? []).map((song) => ({ ...song, title: normalise(song.title), artist: normalise(song.artist), form: normalise(song.form), type: normalise(song.type) }));
  initialise();
} catch (error) {
  console.error(error);
  title.textContent = '楽曲情報を読み込めませんでした';
  description.textContent = '時間をおいて再読み込みしてください。';
}
