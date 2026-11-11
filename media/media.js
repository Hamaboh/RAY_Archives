const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const mediaLabel = (value) => normalise(value).split(/\s+-\s+/)[0] || 'リンク';
const artistOptions = ['RAY', '内山結愛', '甲斐莉乃', '白川さやか', '月日', '琴山しずく', '愛海', '月海まお', '紬実詩', '春音友希', '大黒メロンちゃん', 'ねりね', 'ﾐﾔﾊﾗｸﾝ', '江頭', 'のうまらいず', '小林輝哉', '古村雪'];
function safeUrl(value) {
  try {
    const url = new URL(normalise(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

const title = $('#media-results-title');
const description = $('#media-results-description');
const list = $('#media-list');
const empty = $('#media-empty');
const filter = $('#media-filter');
const artistFilter = $('#media-artist-filter');

function artistMarkup(artists) {
  if (!artists.length) return '';
  return `<ul class="event-performers media-artists" aria-label="アーティスト名">${artists.map((artist) => `<li>${escapeHtml(artist)}</li>`).join('')}</ul>`;
}

function recordLinks(record) {
  const links = record.links?.length ? record.links : [{ medium: record.medium, url: record.url }];
  return links.map(({ medium, url }) => ({ medium: mediaLabel(medium), url: safeUrl(url) })).filter(({ url }) => url);
}

function recordMarkup(record) {
  const links = recordLinks(record);
  const media = [...new Set(links.map(({ medium }) => medium))].join(' / ') || mediaLabel(record.medium);
  const dateTime = record.date || '';
  const link = links.length ? `<div class="media-links">${links.map(({ medium, url }) => `<a class="media-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(medium)}の詳細はこちら">詳細はこちら <span aria-hidden="true">→</span></a>`).join('')}</div>` : '';
  return `<article class="media-card"><time datetime="${escapeHtml(dateTime)}">${escapeHtml(record.dateLabel || '日付未登録')}</time><div class="media-card-main"><p>${escapeHtml(media)}</p><h3>${escapeHtml(record.title || 'タイトル未登録')}</h3></div>${link}${artistMarkup(record.artists || [])}</article>`;
}

function orderByDate(first, second) {
  return (first.date || '9999-12-31').localeCompare(second.date || '9999-12-31', 'ja')
    || first.dateLabel.localeCompare(second.dateLabel, 'ja')
    || first.title.localeCompare(second.title, 'ja');
}

function render(records) {
  const selectedMedium = filter.value;
  const selectedArtist = artistFilter.value;
  const visible = records.filter((record) => (
    (!selectedMedium || recordLinks(record).some(({ medium }) => medium === selectedMedium))
    && (!selectedArtist || record.artists.includes(selectedArtist))
  ));
  description.textContent = `${visible.length.toLocaleString('ja-JP')}件を発信日の昇順に表示しています。`;
  list.innerHTML = visible.map(recordMarkup).join('');
  empty.hidden = visible.length !== 0;
}

try {
  const response = await fetch('../data/media.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const records = (payload.media ?? []).map((record) => ({
    ...record,
    title: normalise(record.title),
    medium: normalise(record.medium),
    dateLabel: normalise(record.dateLabel),
    artists: (record.artists ?? []).map(normalise).filter(Boolean),
    links: (record.links ?? []).map((link) => ({ medium: normalise(link.medium), url: normalise(link.url) })),
  })).sort(orderByDate);
  const mediums = [...new Set(records.flatMap((record) => recordLinks(record).map(({ medium }) => medium)))].sort((first, second) => first.localeCompare(second, 'ja'));
  filter.innerHTML += mediums.map((medium) => `<option value="${escapeHtml(medium)}">${escapeHtml(medium)}</option>`).join('');
  artistFilter.innerHTML += artistOptions.map((artist) => `<option value="${escapeHtml(artist)}">${escapeHtml(artist)}</option>`).join('');
  title.textContent = 'すべてのメディア情報';
  render(records);
  filter.addEventListener('change', () => render(records));
  artistFilter.addEventListener('change', () => render(records));
} catch (error) {
  console.error(error);
  title.textContent = 'メディア情報を読み込めませんでした。';
  description.textContent = '時間をおいて再読み込みしてください。';
  empty.hidden = true;
}
