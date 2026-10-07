const overview = document.querySelector('#overview');
const archiveView = document.querySelector('#archive-view');
const searchInput = document.querySelector('#archive-search');
const searchResults = document.querySelector('#search-results');
const status = document.querySelector('#archive-status');
const navigation = document.querySelector('#global-nav');
const syncInfo = document.querySelector('#sync-info');
const menuButton = document.querySelector('#menu-button');

let archive;
let blocks;
let sections;
let index = [];

const textOf = (value) => {
  if (!Array.isArray(value)) return '';
  return value.map((part) => Array.isArray(part) ? String(part[0] ?? '') : '').join('');
};
const titleOf = (block) => textOf(block?.properties?.title) || textOf(block?.properties?.caption) || '';
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[character]);
const normalise = (value) => value.replace(/\s+/g, ' ').trim();
const safeExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

function richText(value) {
  if (!Array.isArray(value)) return '';
  return value.map((part) => {
    if (!Array.isArray(part)) return '';
    const content = escapeHtml(part[0] ?? '');
    const annotation = Array.isArray(part[1]) ? part[1].find((item) => Array.isArray(item) && item[0] === 'a') : null;
    const url = safeExternalUrl(annotation?.[1]);
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${content}</a>` : content;
  }).join('');
}

function propertyRows(block) {
  const properties = Object.entries(block.properties ?? {}).filter(([key]) => key !== 'title' && key !== 'caption');
  if (!properties.length) return '';
  return `<dl class="property-list">${properties.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${richText(value) || escapeHtml(textOf(value))}</dd>`).join('')}</dl>`;
}

function lineage(id) {
  const names = [];
  const seen = new Set();
  let current = blocks[id];
  while (current?.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    current = blocks[current.parent_id];
    const name = titleOf(current);
    if (name) names.push(name);
  }
  return names.reverse();
}

function renderRecord(id, level = 0, opened = false) {
  const block = blocks[id];
  if (!block || block.alive === false) return '';
  const title = titleOf(block);
  const children = (block.content ?? []).map((childId) => renderRecord(childId, level + 1)).join('');
  const body = `${propertyRows(block)}${children}`;
  if (!title && !body) return '';
  if (!body) return `<article class="record leaf"><p>${richText(block.properties?.title) || escapeHtml(title)}</p></article>`;
  return `<details class="record" ${opened ? 'open' : ''}><summary><span class="record-title">${richText(block.properties?.title) || escapeHtml(title || '詳細')}</span><span class="record-kind">${escapeHtml(block.type ?? 'record')}</span></summary><div class="record-body">${body || '<p class="empty-note">記録なし</p>'}</div></details>`;
}

function showSection(id, focus = true) {
  const section = sections.find((item) => item.id === id);
  if (!section) return;
  const sectionTitle = titleOf(section) || '記録';
  archiveView.innerHTML = `<div class="archive-heading"><h2>${escapeHtml(sectionTitle)}</h2><button type="button" id="back-to-index">一覧へ戻る</button></div><div class="branch">${renderRecord(id, 0, true)}</div>`;
  overview.hidden = true;
  searchResults.innerHTML = '';
  navigation.querySelectorAll('button').forEach((button) => button.setAttribute('aria-current', String(button.dataset.id === id)));
  document.querySelector('#back-to-index').addEventListener('click', showOverview);
  if (focus) archiveView.scrollIntoView({ behavior:'smooth', block:'start' });
}

function showOverview() {
  archiveView.innerHTML = '';
  overview.hidden = false;
  navigation.querySelectorAll('button').forEach((button) => button.removeAttribute('aria-current'));
  overview.scrollIntoView({ behavior:'smooth', block:'start' });
}

function buildIndex() {
  index = Object.values(blocks).map((block) => ({
    id: block.id,
    title: titleOf(block),
    text: normalise(Object.values(block.properties ?? {}).map(textOf).join(' ')),
    path: lineage(block.id),
  })).filter((item) => item.text);
}

function search(query) {
  const words = normalise(query).toLocaleLowerCase('ja-JP').split(' ').filter(Boolean);
  if (!words.length) { searchResults.innerHTML = ''; return; }
  const results = index.filter((item) => words.every((word) => item.text.toLocaleLowerCase('ja-JP').includes(word))).slice(0, 80);
  searchResults.innerHTML = `<p class="search-heading">${results.length ? `${results.length}${results.length === 80 ? '+' : ''} 件` : '一致する記録はありません'}</p>${results.length ? `<ul class="result-list">${results.map((result) => `<li><button type="button" data-section="${escapeHtml((result.path.length ? sections.find((section) => result.path.includes(titleOf(section)))?.id : null) || '')}">${escapeHtml(result.title || result.text.slice(0, 100))}</button><small>${escapeHtml(result.path.join(' / '))}</small></li>`).join('')}</ul>` : ''}`;
  searchResults.querySelectorAll('button[data-section]').forEach((button) => button.addEventListener('click', () => { if (button.dataset.section) showSection(button.dataset.section); }));
}

function setupInterface() {
  const root = blocks[archive.sourceRootId];
  sections = (root.content ?? []).map((id) => blocks[id]).filter((block) => block && titleOf(block));
  overview.innerHTML = sections.map((section, number) => `<button type="button" class="section-card" data-id="${section.id}"><span class="number">${String(number + 1).padStart(2, '0')}</span><strong>${escapeHtml(titleOf(section))}</strong><small>${section.content?.length ?? 0} RECORD GROUPS</small></button>`).join('');
  overview.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => showSection(button.dataset.id)));
  navigation.innerHTML = sections.map((section) => `<button type="button" data-id="${section.id}">${escapeHtml(titleOf(section))}</button>`).join('');
  navigation.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { showSection(button.dataset.id); navigation.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));
  buildIndex();
  status.textContent = `${index.length.toLocaleString('ja-JP')} 件の記録を収録`;
  syncInfo.textContent = `LAST SYNC ${new Date(archive.syncedAt).toLocaleDateString('ja-JP')}`;
}

menuButton.addEventListener('click', () => { const opened = navigation.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(opened)); });
searchInput.addEventListener('input', () => search(searchInput.value));

try {
  const response = await fetch('./data/archive.json', { cache:'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  archive = await response.json();
  blocks = archive.blocks;
  setupInterface();
} catch (error) {
  console.error(error);
  status.textContent = 'アーカイブを読み込めませんでした。';
  archiveView.innerHTML = '<p class="empty-note">データファイルの読み込みに失敗しました。同期後に再読み込みしてください。</p>';
}
