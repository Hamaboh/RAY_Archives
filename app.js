const rootId = '3b99b75f-ba95-8053-a405-e67018a0ba59';
const batchSize = 160;
const $ = (selector) => document.querySelector(selector);
const searchInput = $('#archive-search');
const categoryFilter = $('#category-filter');
const yearFilter = $('#year-filter');
const sortOrder = $('#sort-order');
const clearFilters = $('#clear-filters');
const recordsList = $('#records');
const emptyState = $('#empty-state');
const sentinel = $('#load-sentinel');
const categorySummary = $('#category-summary');
const recordTotal = $('#record-total');
const visibleCount = $('#visible-count');
const filterSummary = $('#filter-summary');
const syncInfo = $('#sync-info');

let blocks = {}, rootSections = [], entries = [], filtered = [], rendered = 0;
const normalise = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const textOf = (value) => Array.isArray(value) ? value.map((part) => Array.isArray(part) ? String(part[0] ?? '') : '').join('') : '';
const titleOf = (block) => normalise(textOf(block?.properties?.title) || textOf(block?.properties?.caption));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[character]);

function parentPath(id) {
  const chain = [], seen = new Set(); let current = blocks[id];
  while (current?.parent_id && !seen.has(current.id)) { seen.add(current.id); current = blocks[current.parent_id]; if (!current) break; const title = titleOf(current); if (title) chain.push({ id:current.id, title }); }
  return chain.reverse();
}
function dateInfo(value) {
  const match = value.match(/(20\d{2})年(?:\s*(\d{1,2})月)?(?:\s*(\d{1,2})日)?/) || value.match(/(20\d{2})[/.\-](\d{1,2})(?:[/.\-](\d{1,2}))?/);
  if (!match) return { year:'', label:'記録日未詳', sort:0 };
  const year = match[1], month = match[2] ? String(match[2]).padStart(2, '0') : '00', day = match[3] ? String(match[3]).padStart(2, '0') : '00';
  return { year, label:month === '00' ? year : `${year}.${month}${day === '00' ? '' : `.${day}`}`, sort:Number(`${year}${month}${day}`) };
}
function categoryFor(path) { return path.find((part) => rootSections.some((section) => section.id === part.id))?.title ?? 'その他'; }
function detailsOf(block) { return Object.entries(block.properties ?? {}).filter(([key]) => !['title','caption'].includes(key)).map(([key,value]) => [normalise(key),normalise(textOf(value))]).filter(([,value]) => value).slice(0,3); }

function buildEntries() {
  entries = Object.values(blocks).flatMap((block) => {
    const title = titleOf(block);
    const isStructuralHeading = ['page', 'toggle'].includes(block.type) && (
      /^イベント出演情報_20\d{2}年(?:\d{1,2}月)?$/.test(title) ||
      /^メディア情報_20\d{2}年$/.test(title) ||
      /^グッズ_.+_20\d{2}年$/.test(title) ||
      /^20\d{2}年(?:\d{1,2}月)?$/.test(title)
    );
    if (!title || isStructuralHeading || block.id === rootId || rootSections.some((section) => section.id === block.id)) return [];
    const path = parentPath(block.id), category = categoryFor(path), details = detailsOf(block);
    return [{ id:block.id, title, category, path, details, date:dateInfo(`${title} ${path.map((part) => part.title).join(' ')}`), type:block.type ?? 'record', searchable:normalise([title,category,path.map((part) => part.title).join(' '),...details.flat()].join(' ')) }];
  });
}
function renderControls() {
  const categories = rootSections.map(titleOf), years = [...new Set(entries.map((entry) => entry.date.year).filter(Boolean))].sort((a,b) => b.localeCompare(a));
  categoryFilter.insertAdjacentHTML('beforeend', categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join(''));
  yearFilter.insertAdjacentHTML('beforeend', years.map((year) => `<option value="${year}">${year}年</option>`).join(''));
  categorySummary.innerHTML = categories.map((category) => `<button type="button" data-category="${escapeHtml(category)}" aria-pressed="false"><strong>${escapeHtml(category)}</strong><span>${entries.filter((entry) => entry.category === category).length.toLocaleString('ja-JP')} RECORDS</span></button>`).join('');
  categorySummary.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { categoryFilter.value = categoryFilter.value === button.dataset.category ? 'all' : button.dataset.category; applyFilters(); categoryFilter.focus(); }));
}
function activeText() { const parts=[]; if(categoryFilter.value !== 'all')parts.push(categoryFilter.value); if(yearFilter.value !== 'all')parts.push(`${yearFilter.value}年`); if(normalise(searchInput.value))parts.push(`「${normalise(searchInput.value)}」`); return parts.length ? parts.join(' / ') : 'すべての分類・年'; }
function compareEntries(a,b) { if(sortOrder.value === 'title')return a.title.localeCompare(b.title,'ja'); const direction=sortOrder.value === 'oldest'?1:-1; return direction*((a.date.sort||-1)-(b.date.sort||-1))||a.title.localeCompare(b.title,'ja'); }
function recordMarkup(entry,number) {
  const details = entry.details.length ? entry.details.map(([key,value]) => `<span><b>${escapeHtml(key)}</b>${escapeHtml(value)}</span>`).join('') : `<span>${escapeHtml(entry.path.slice(-2).map((part) => part.title).join(' / ') || '詳細情報を収録')}</span>`;
  return `<li class="record" id="record-${entry.id}" tabindex="-1" data-index="${number}"><div class="record-date">${escapeHtml(entry.date.label)}</div><div class="record-title">${escapeHtml(entry.title)}</div><div class="record-detail">${details}</div><div class="record-meta"><em>${escapeHtml(entry.category)}</em>${escapeHtml(entry.type)}</div></li>`;
}
function appendBatch() { const next=filtered.slice(rendered,rendered+batchSize); if(!next.length)return; const start=rendered; recordsList.querySelector('.load-note')?.remove(); recordsList.insertAdjacentHTML('beforeend',next.map((entry,offset)=>recordMarkup(entry,start+offset)).join('')); rendered+=next.length; if(rendered<filtered.length)recordsList.insertAdjacentHTML('beforeend','<li class="load-note">スクロールすると続きの記録を表示します</li>'); }
function applyFilters() {
  const words=normalise(searchInput.value).toLocaleLowerCase('ja-JP').split(' ').filter(Boolean);
  filtered=entries.filter((entry)=>(categoryFilter.value==='all'||entry.category===categoryFilter.value)&&(yearFilter.value==='all'||entry.date.year===yearFilter.value)&&words.every((word)=>entry.searchable.toLocaleLowerCase('ja-JP').includes(word))).sort(compareEntries);
  rendered=0; recordsList.innerHTML=''; emptyState.hidden=filtered.length!==0; appendBatch(); visibleCount.textContent=`${filtered.length.toLocaleString('ja-JP')} 件`; filterSummary.textContent=`${activeText()} — ${filtered.length.toLocaleString('ja-JP')}件`;
  categorySummary.querySelectorAll('button').forEach((button)=>button.setAttribute('aria-pressed',String(categoryFilter.value===button.dataset.category)));
}
function focusRelative(direction) { const nodes=[...recordsList.querySelectorAll('.record')]; if(!nodes.length)return; const current=document.activeElement.closest?.('.record'), index=current?nodes.indexOf(current):(direction>0?-1:nodes.length); nodes[Math.max(0,Math.min(nodes.length-1,index+direction))].focus({preventScroll:false}); }
function setupEvents() {
  [searchInput,categoryFilter,yearFilter,sortOrder].forEach((element)=>element.addEventListener('input',applyFilters));
  clearFilters.addEventListener('click',()=>{searchInput.value='';categoryFilter.value='all';yearFilter.value='all';sortOrder.value='newest';applyFilters();searchInput.focus();});
  document.addEventListener('keydown',(event)=>{ if(event.key==='/'&&document.activeElement!==searchInput){event.preventDefault();searchInput.focus();} if(event.key==='Escape'&&document.activeElement===searchInput){searchInput.value='';applyFilters();} if(!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){if(event.key.toLowerCase()==='j'){event.preventDefault();focusRelative(1);}if(event.key.toLowerCase()==='k'){event.preventDefault();focusRelative(-1);}} });
  new IntersectionObserver((observed)=>{if(observed.some((item)=>item.isIntersecting)&&rendered<filtered.length)appendBatch();},{rootMargin:'700px'}).observe(sentinel);
}
try {
  const response=await fetch('./data/archive.json',{cache:'no-cache'}); if(!response.ok)throw new Error(`HTTP ${response.status}`); const archive=await response.json(); blocks=archive.blocks;
  rootSections=(blocks[rootId]?.content??[]).map((id)=>blocks[id]).filter((block)=>block&&titleOf(block)); buildEntries(); renderControls(); setupEvents(); applyFilters(); recordTotal.textContent=`${entries.length.toLocaleString('ja-JP')} RECORDS`; syncInfo.textContent=`LAST SYNC ${new Date(archive.syncedAt).toLocaleDateString('ja-JP')}`;
} catch(error) { console.error(error); recordTotal.textContent='DATA ERROR'; emptyState.hidden=false; emptyState.textContent='アーカイブデータを読み込めませんでした。時間をおいて再読み込みしてください。'; }
