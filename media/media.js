const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const mediaLabel = (value) => normalise(value).split(/\s+-\s+/)[0] || 'リンク';
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

function artistMarkup(artists) {
  if (!artists.length) return '';
  return `<ul class="event-performers media-artists" aria-label="アーティスト名">${artists.map((artist) => `<li>${escapeHtml(artist)}</li>`).join('')}</ul>`;
}

function recordMarkup(record) {
  const medium = mediaLabel(record.medium);
  const dateTime = record.date || '';
  const url = safeUrl(record.url);
  const link = url ? `<a class="media-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(medium)}はこちら <span aria-hidden="true">→</span></a>` : '';
  return `<article class="media-card"><time datetime="${escapeHtml(dateTime)}">${escapeHtml(record.dateLabel || '日付未登録')}</time><div class="media-card-main"><p>${escapeHtml(medium)}</p><h3>${escapeHtml(record.title || 'タイトル未登録')}</h3></div>${link}${artistMarkup(record.artists || [])}</article>`;
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
  }));
  title.textContent = 'すべてのメディア情報';
  description.textContent = `${records.length.toLocaleString('ja-JP')}件を発信日順に表示しています。`;
  list.innerHTML = records.map(recordMarkup).join('');
  empty.hidden = records.length !== 0;
} catch (error) {
  console.error(error);
  title.textContent = 'メディア情報を読み込めませんでした。';
  description.textContent = '時間をおいて再読み込みしてください。';
  empty.hidden = true;
}
