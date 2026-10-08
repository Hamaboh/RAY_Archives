const rootId = '3b99b75f-ba95-8053-a405-e67018a0ba59';
const $ = (selector) => document.querySelector(selector);
const searchInput = $('#archive-search');
const categoryNav = $('#category-nav');
const archiveTree = $('#archive-tree');
const treeTitle = $('#tree-title');
const treeBreadcrumb = $('#tree-breadcrumb');
const treeDescription = $('#tree-description');
const emptyState = $('#empty-state');
const searchStatus = $('#search-status');
const recordTotal = $('#record-total');
const syncInfo = $('#sync-info');

let blocks = {}, rootSections = [], records = [], descendantCounts = new Map(), selectedId = '';
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const textOf = (value) => Array.isArray(value) ? value.map((part) => Array.isArray(part) ? String(part[0] ?? '') : '').join('') : '';
const titleOf = (block) => normalise(textOf(block?.properties?.title) || textOf(block?.properties?.caption));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[character]);

function aliveChildren(block) { return (block?.content ?? []).map((id) => blocks[id]).filter((item) => item?.alive !== false); }
function displayChildren(block) {
  const children = aliveChildren(block); const title = titleOf(block);
  if (title === 'イベント出演情報' || /^イベント出演情報_20\d{2}年$/.test(title)) {
    return children.slice().sort((a, b) => {
      const aCount = descendantCounts.get(a.id) ?? 0, bCount = descendantCounts.get(b.id) ?? 0;
      if (Boolean(aCount) !== Boolean(bCount)) return bCount - aCount;
      return dateFrom(titleOf(b)).sort - dateFrom(titleOf(a)).sort;
    });
  }
  if (/^イベント出演情報_20\d{2}年\d{1,2}月$/.test(title)) {
    return children.slice().sort((a, b) => {
      const dateDifference = dateFrom(titleOf(b)).sort - dateFrom(titleOf(a)).sort;
      if (dateDifference) return dateDifference;
      const aIsTemplate = !titleOf(a) || titleOf(a) === 'テンプレート';
      const bIsTemplate = !titleOf(b) || titleOf(b) === 'テンプレート';
      return Number(aIsTemplate) - Number(bIsTemplate);
    });
  }
  return children;
}
function parentPath(id) {
  const result = [], seen = new Set(); let current = blocks[id];
  while (current?.parent_id && !seen.has(current.id)) { seen.add(current.id); current = blocks[current.parent_id]; if (!current) break; const title = titleOf(current); if (title) result.push({ id:current.id, title }); }
  return result.reverse();
}
function propertiesOf(block) { return Object.entries(block.properties ?? {}).filter(([key]) => !['title', 'caption'].includes(key)).map(([key, value]) => [normalise(key), normalise(textOf(value))]).filter(([, value]) => value); }
function dateFrom(value) { const match = value.match(/(20\d{2})年(?:\s*(\d{1,2})月)?(?:\s*(\d{1,2})日)?/) || value.match(/(20\d{2})[/.-](\d{1,2})(?:[/.-](\d{1,2}))?/); if (!match) return { year:'', sort:0 }; const [,year,month='00',day='00'] = match; return { year, sort:Number(`${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`) }; }
function kindLabel(block, depth) { if (depth === 1 && /20\d{2}年/.test(titleOf(block))) return 'YEAR'; if (depth === 2 && /20\d{2}年\d{1,2}月/.test(titleOf(block))) return 'MONTH'; const labels = { page:'PAGE', toggle:'GROUP', sub_sub_header:'SECTION', bulleted_list:'NOTE', numbered_list:'ITEM', text:'TEXT' }; return labels[block.type] ?? 'RECORD'; }

function countDescendants(id, visiting = new Set()) {
  if (descendantCounts.has(id)) return descendantCounts.get(id);
  if (visiting.has(id)) return 0;
  visiting.add(id); const count = aliveChildren(blocks[id]).reduce((total, child) => total + 1 + countDescendants(child.id, visiting), 0); visiting.delete(id); descendantCounts.set(id, count); return count;
}
function buildRecords() {
  records = Object.values(blocks).flatMap((block) => {
    const title = titleOf(block); if (!title || block.id === rootId || rootSections.some((section) => section.id === block.id)) return [];
    const path = parentPath(block.id); const text = normalise([title, ...path.map((part) => part.title), ...propertiesOf(block).flat()].join(' '));
    return [{ id:block.id, title, path, text, date:dateFrom(`${title} ${path.map((part) => part.title).join(' ')}`) }];
  });
}
function branchMarkup(block, depth, autoOpen = false) {
  const childCount = descendantCounts.get(block.id) ?? 0;
  const properties = propertiesOf(block);
  if (!aliveChildren(block).length) return `<article class="tree-leaf" style="--depth:${depth}"><div class="tree-leaf-title">${escapeHtml(titleOf(block) || '無題の記録')}</div>${properties.length ? `<ul class="tree-leaf-properties">${properties.map(([key,value]) => `<li><b>${escapeHtml(key)}</b>${escapeHtml(value)}</li>`).join('')}</ul>` : ''}</article>`;
  return `<details class="tree-node" data-id="${block.id}" data-depth="${depth}" ${autoOpen ? 'open data-auto-open="true"' : ''} style="--depth:${depth}"><summary><span class="node-copy"><span class="node-title">${escapeHtml(titleOf(block) || '詳細')}</span><span class="node-meta">${kindLabel(block, depth)}</span></span><span class="node-count">${childCount.toLocaleString('ja-JP')} RECORDS</span></summary><div class="tree-children"><p class="branch-loading">読み込み中…</p></div></details>`;
}
function setupTreeEvents(scope = archiveTree) {
  scope.querySelectorAll('details.tree-node').forEach((details) => details.addEventListener('toggle', () => { if (details.open) fillBranch(details); }));
}
function fillBranch(details) {
  if (details.dataset.loaded === 'true') return;
  const block = blocks[details.dataset.id]; if (!block) return;
  const depth = Number(details.dataset.depth ?? 0) + 1;
  const shouldOpenFirst = details.dataset.autoOpen === 'true' && depth <= 4;
  const target = details.querySelector('.tree-children');
  target.innerHTML = displayChildren(block).map((child, index) => branchMarkup(child, depth, shouldOpenFirst && index === 0)).join('');
  details.dataset.loaded = 'true'; setupTreeEvents(target);
  target.querySelectorAll('details[data-auto-open="true"]').forEach((child) => fillBranch(child));
}
function renderCategory(id) {
  selectedId = id; const section = blocks[id]; const number = rootSections.findIndex((item) => item.id === id) + 1;
  treeTitle.textContent = titleOf(section); treeBreadcrumb.textContent = `RAY ARCHIVES  /  ${String(number).padStart(2,'0')}  /  ${titleOf(section)}`;
  treeDescription.textContent = `この分類には ${countDescendants(id).toLocaleString('ja-JP')} 件の関連記録があります。見出しを開くと、元の親子関係を保ったまま下位の記録を表示します。`;
  archiveTree.innerHTML = displayChildren(section).map((child, index) => branchMarkup(child, 1, index === 0)).join('');
  setupTreeEvents(); archiveTree.querySelectorAll('details[data-auto-open="true"]').forEach((details) => fillBranch(details));
  emptyState.hidden = true; searchStatus.textContent = `${titleOf(section)}の階層を表示中`;
  categoryNav.querySelectorAll('button').forEach((button) => button.setAttribute('aria-current', String(button.dataset.id === id)));
}
function renderSearch() {
  const query = normalise(searchInput.value); if (!query) { renderCategory(selectedId); return; }
  const words = query.toLocaleLowerCase('ja-JP').split(' ').filter(Boolean);
  const results = records.filter((record) => words.every((word) => record.text.toLocaleLowerCase('ja-JP').includes(word))).sort((a,b) => b.date.sort - a.date.sort || a.title.localeCompare(b.title, 'ja')).slice(0, 180);
  treeTitle.textContent = `「${query}」の検索結果`; treeBreadcrumb.textContent = 'RAY ARCHIVES  /  SEARCH'; treeDescription.textContent = `${results.length.toLocaleString('ja-JP')}${results.length === 180 ? '件以上' : '件'}を表示。検索結果では、各記録が属する階層をパンくずで確認できます。`;
  archiveTree.innerHTML = results.length ? `<ol class="search-results">${results.map((record) => `<li class="search-result"><div><div class="search-result-title">${escapeHtml(record.title)}</div><p class="search-result-path">${escapeHtml(record.path.map((part) => part.title).join('  ›  '))}</p></div><span class="search-result-date">${record.date.year || 'DATE N/A'}</span></li>`).join('')}</ol>` : '';
  emptyState.hidden = results.length !== 0; searchStatus.textContent = `「${query}」— ${results.length.toLocaleString('ja-JP')}${results.length === 180 ? '件以上' : '件'}`;
}
function renderNavigation() {
  categoryNav.innerHTML = rootSections.map((section, index) => `<button type="button" data-id="${section.id}" aria-current="false"><span class="category-number">${String(index + 1).padStart(2,'0')}</span><span><strong>${escapeHtml(titleOf(section))}</strong><small>${countDescendants(section.id).toLocaleString('ja-JP')} RECORDS</small></span></button>`).join('');
  categoryNav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { searchInput.value = ''; renderCategory(button.dataset.id); }));
}
function setupEvents() {
  searchInput.addEventListener('input', renderSearch);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchInput) { event.preventDefault(); searchInput.focus(); return; }
    if (event.key === 'Escape' && document.activeElement === searchInput) { searchInput.value = ''; renderCategory(selectedId); return; }
    if (!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && /^[1-9]$/.test(event.key)) { const target = rootSections[Number(event.key) - 1]; if (target) { searchInput.value = ''; renderCategory(target.id); } }
  });
}
try {
  const response = await fetch('./data/archive.json', { cache:'no-cache' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const archive = await response.json(); blocks = archive.blocks;
  rootSections = (blocks[rootId]?.content ?? []).map((id) => blocks[id]).filter((block) => block && titleOf(block));
  rootSections.forEach((section) => countDescendants(section.id)); buildRecords(); renderNavigation(); selectedId = rootSections.find((section) => titleOf(section) === 'イベント出演情報')?.id ?? rootSections[0]?.id; renderCategory(selectedId); setupEvents();
  recordTotal.textContent = `${records.length.toLocaleString('ja-JP')} RECORDS`; syncInfo.textContent = `LAST SYNC ${new Date(archive.syncedAt).toLocaleDateString('ja-JP')}`;
} catch (error) { console.error(error); recordTotal.textContent = 'DATA ERROR'; treeTitle.textContent = 'アーカイブを読み込めませんでした'; treeDescription.textContent = '時間をおいて再読み込みしてください。'; }
