const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const isValue = (value) => Boolean(normalise(value)) && normalise(value) !== '-';
const humanDate = (song) => song.year ? `${song.year}年${String(song.month).padStart(2, '0')}月${String(song.day).padStart(2, '0')}日${song.time ? ` ${song.time}` : ''}` : '初披露日未登録';
const search = $('#song-search');
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

function optionMarkup(value) { return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`; }
function isSame(value, filter) { return !filter || value === filter; }
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
  const metadata = [song.type, song.artist, song.form !== song.artist ? song.form : ''].filter(isValue).join(' / ');
  return `<article class="song-card"><div class="song-card-main"><p class="song-date">${escapeHtml(humanDate(song))}</p><h3>${escapeHtml(song.title)}</h3><p class="song-meta">${escapeHtml(metadata || '情報未登録')}</p></div>${creditsMarkup(song)}</article>`;
}
function filteredSongs() {
  const query = normalise(search.value).toLocaleLowerCase('ja-JP');
  return songs.filter((song) => {
    const searchable = [song.title, song.artist, song.form, song.type, song.originalArtist, song.lyrics, song.composition, song.arrangement, song.choreography, song.alternateVersion].join(' ').toLocaleLowerCase('ja-JP');
    return (!query || searchable.includes(query)) && isSame(song.artist, artistFilter.value) && isSame(song.type, typeFilter.value);
  });
}
function renderSongs() {
  const visible = filteredSongs();
  const active = [normalise(search.value) ? `「${normalise(search.value)}」` : '', artistFilter.value, typeFilter.value].filter(Boolean);
  title.textContent = active.length ? '絞り込み結果' : 'すべての楽曲';
  description.textContent = `${visible.length.toLocaleString('ja-JP')}曲を表示${active.length ? `：${active.join('・')}` : '。初披露日順に表示しています。'}`;
  status.textContent = active.length ? `${active.length}項目で絞り込み中` : 'すべての楽曲を表示';
  const years = new Map();
  visible.forEach((song) => {
    const key = song.year || '未登録';
    if (!years.has(key)) years.set(key, []);
    years.get(key).push(song);
  });
  list.innerHTML = [...years.entries()].sort(([first], [second]) => first === '未登録' ? 1 : second === '未登録' ? -1 : first.localeCompare(second, 'ja')).map(([year, entries]) => `<section class="song-year"><header><h3>${year === '未登録' ? '初披露日未登録' : year}</h3><span>${entries.length} SONGS</span></header><div class="song-cards">${entries.map(songMarkup).join('')}</div></section>`).join('');
  empty.hidden = visible.length !== 0;
}
function initialise() {
  const artists = [...new Set(songs.map((song) => song.artist).filter(isValue))].sort((first, second) => first.localeCompare(second, 'ja'));
  const types = [...new Set(songs.map((song) => song.type).filter(isValue))].sort((first, second) => first.localeCompare(second, 'ja'));
  artistFilter.insertAdjacentHTML('beforeend', artists.map(optionMarkup).join(''));
  typeFilter.insertAdjacentHTML('beforeend', types.map(optionMarkup).join(''));
  total.textContent = songs.length.toLocaleString('ja-JP');
  artistTotal.textContent = artists.length.toLocaleString('ja-JP');
  formTotal.textContent = new Set(songs.map((song) => song.form).filter(isValue)).size.toLocaleString('ja-JP');
  [search, artistFilter, typeFilter].forEach((input) => input.addEventListener(input === search ? 'input' : 'change', renderSongs));
  renderSongs();
}

try {
  const response = await fetch('../data/songs.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  songs = ((await response.json()).songs ?? []).map((song) => ({ ...song, title: normalise(song.title), artist: normalise(song.artist), form: normalise(song.form), type: normalise(song.type) }));
  initialise();
} catch (error) {
  console.error(error);
  title.textContent = '楽曲情報を読み込めませんでした';
  description.textContent = '時間をおいて再読み込みしてください。';
}
