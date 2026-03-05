// ════════════════════════════════════════════════════════
//  YouTube SEO Generator — app.js
//
//  Counting method (verified):
//  YouTube counts NFC JS .length of the comma-separated tag string.
//  All Vietnamese chars are BMP → .length == code point count == correct.
//  Limit: 500 characters (not bytes).
// ════════════════════════════════════════════════════════

let numHash = 10;
let lastTagsVal = '';
let lastHashVal = '';

function adjustHash(d) {
  numHash = Math.min(15, Math.max(3, numHash + d));
  document.getElementById('numHashDisplay').textContent = numHash;
}

// ════════════════════════════════════════════
//  TEXT UTILITIES
// ════════════════════════════════════════════

function deaccent(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function cleanStr(s) {
  return s.toLowerCase().trim()
    .replace(/[|\/\\,!?@#%^*()+=\[\]{}"'<>~`]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function uniq(arr) {
  const seen = new Set();
  return arr.filter(s => {
    const k = (typeof s === 'string' ? s : s.text).toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// ── Exact YouTube tag-string character count ──
// YouTube joins tags with ", " and counts NFC .length of the full string.
function ytCharCount(tags) {
  if (!tags.length) return 0;
  return tags.join(', ').normalize('NFC').length;
}

// Vietnamese + English stopwords
const STOP = new Set([
  'từ','và','hay','là','đến','vào','của','trong','trở','thành','để','với',
  'một','các','có','không','được','cho','khi','sau','trên','này','đó','đây',
  'qua','về','ra','lên','xuống','lại','bởi','ở','rồi','nên','mà','nhưng',
  'còn','thì','đã','sẽ','đang','bị','như','theo','cùng','hoặc',
  'the','a','an','to','of','in','on','at','by','for','as','is','it','its',
  'was','are','be','been','with','that','this','from','or','but','not',
  'and','all','also','can','has','have','had','do','did','will','would',
]);

// ════════════════════════════════════════════
//  ENTITY & KEYWORD EXTRACTION
// ════════════════════════════════════════════

function extractEntities(text) {
  const brands = [], numbers = [];
  text.split(/[\s|,\-–—]+/).forEach(t => {
    if (/^[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÝĂĐƠƯ][a-záàâãéèêíìîóòôõúùûýăđơư]{2,}/.test(t))
      brands.push(t);
    if (/\d/.test(t))
      numbers.push(t.toLowerCase());
  });
  return { brands: [...new Set(brands)], numbers: [...new Set(numbers)] };
}

// TF-IDF inspired keyword scoring
function scoreKeywords(title, topic) {
  const titleC = cleanStr(title);
  const topicC = cleanStr(topic);
  // Weight topic 3x so topic keywords always score highest
  const combined = `${topicC} ${topicC} ${topicC} ${titleC}`;
  const words = combined.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

  const freq = {};
  words.forEach((w, i) => {
    if (!freq[w]) freq[w] = { count: 0, firstPos: i, total: words.length };
    freq[w].count++;
  });

  return Object.entries(freq).map(([word, data]) => {
    const tf         = data.count / data.total;
    const lenBonus   = Math.min(word.length / 8, 2.0);   // longer = more specific
    const posBonus   = 1 + (1 - data.firstPos / data.total); // earlier = more important
    const topicBoost = topicC.includes(word) ? 3.0 : 1;
    return { word, score: tf * lenBonus * posBonus * topicBoost };
  }).sort((a, b) => b.score - a.score);
}

// ════════════════════════════════════════════
//  NICHE KEYWORD DATABASE  (semantic clusters)
// ════════════════════════════════════════════

const NICHE_DB = {
  restoration: [
    'phục chế xe','phục hồi xe','phục chế xe cũ','phục hồi xe cũ',
    'hồi sinh xe cũ','tái sinh xe cũ','tái chế xe hỏng',
    'xe rỉ sét phục hồi','xe phế liệu phục chế','xe đổ nát phục hồi',
    'biến xe cũ thành siêu xe',
  ],
  supercar: [
    'siêu xe việt nam','siêu xe tự chế','xe tự chế việt nam',
    'độ xe siêu xe','phục chế siêu xe',
    'supercar vietnam','supercar restoration','junk to supercar',
    'supercar rebuild','salvage supercar',
  ],
  motorbike: [
    'xe máy cổ phục hồi','độ xe máy việt nam','phục chế xe máy',
    'xe máy rỉ sét','xe máy cũ phục hồi',
    'motorbike restoration','old motorbike restore','vintage motorbike',
  ],
  international: [
    'car restoration vietnam','restore old car','junk car restoration',
    'salvage car restoration','before after restoration',
    'car rebuild from scratch','old car restoration',
    'abandoned car restoration','rusted car restoration',
    'car transformation','junk car to supercar',
  ],
  hooks: [
    'từ phế liệu','trước và sau','before after',
  ],
  reach: [
    'youtube việt nam','vietnam car','xe việt nam',
    'garage việt nam','thợ xe việt nam',
  ],
};

// ════════════════════════════════════════════
//  MAIN TAG BUILDER
// ════════════════════════════════════════════

function buildTags(title, topic) {
  const titleC  = cleanStr(title);
  const topicC  = cleanStr(topic);
  const titleDa = deaccent(titleC);
  const topicDa = deaccent(topicC);

  const { brands, numbers } = extractEntities(title);
  const topWords = scoreKeywords(title, topic).slice(0, 12).map(s => s.word);

  // ── TIER 1: Exact & high-signal phrases ──
  const tier1 = [];

  // T1-A: exact topic (most important signal)
  tier1.push(topicC);

  // T1-B: main title segment before separator
  const mainSeg = title.split(/[|\-–—]/)[0].trim().toLowerCase()
    .replace(/[^\w\sàáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹ]/g, '').trim();
  if (mainSeg.length >= 4 && mainSeg.length <= 60) tier1.push(mainSeg);

  // T1-C: brand + topic combos
  for (const b of brands.slice(0, 4)) {
    const bl = b.toLowerCase();
    tier1.push(bl);
    tier1.push(`${bl} ${topicC}`);
    tier1.push(`phục chế ${bl}`);
    tier1.push(`restore ${bl}`);
  }

  // T1-D: bigrams from top-scored words
  for (let i = 0; i < Math.min(topWords.length - 1, 8); i++) {
    const bi = `${topWords[i]} ${topWords[i + 1]}`;
    if (bi.length >= 5 && bi.length <= 45) tier1.push(bi);
  }

  // T1-E: topic + top keyword combos
  for (const w of topWords.slice(0, 5)) {
    if (w.length > 3) tier1.push(`${topicC} ${w}`);
  }

  // T1-F: number/price hooks
  for (const n of numbers.slice(0, 2)) {
    tier1.push(`${topicC} ${n}`);
  }

  // ── TIER 2: Semantic niche matches ──
  const tier2 = [];
  const allNiche = Object.values(NICHE_DB).flat();

  for (const term of allNiche) {
    const tL  = term.toLowerCase();
    const tDa = deaccent(tL);
    const hit =
      titleC.includes(tL)   || topicC.includes(tL)   ||
      titleDa.includes(tDa) || topicDa.includes(tDa) ||
      tL.split(' ').some(w => w.length > 4 && (
        topWords.includes(w) || topWords.includes(deaccent(w)) ||
        titleC.includes(w)   || topicC.includes(w)
      ));
    if (hit) tier2.push(term);
  }

  // Always inject universal VN car channel anchors
  tier2.push('phục chế xe', 'car restoration', 'siêu xe việt nam', 'xe việt nam', 'restore car');

  // Long-tail geo modifier
  for (const w of topWords.slice(0, 4)) {
    if (w.length > 3) tier2.push(`${w} việt nam`);
  }

  // ── TIER 3: Reach expansion (no-accent variants + single keywords) ──
  const tier3 = [];
  for (const t of [...tier1, ...tier2].slice(0, 14)) {
    const na = deaccent(t);
    if (na !== t && na.length >= 3) tier3.push(na);
  }
  tier3.push(...topWords.slice(0, 6));
  tier3.push('youtube', 'vietnam', 'viet nam');

  // ── Compile with dedup across tiers ──
  const t1o = uniq(tier1.map(t => ({ text: t.trim(), tier: 1 }))).filter(x => x.text.length >= 3);
  const t2o = uniq(tier2.map(t => ({ text: t.trim(), tier: 2 }))).filter(x => x.text.length >= 3);
  const t3o = uniq(tier3.map(t => ({ text: t.trim(), tier: 3 }))).filter(x => x.text.length >= 3);

  const seen = new Set(t1o.map(x => x.text.toLowerCase()));
  const t2f  = t2o.filter(x => !seen.has(x.text.toLowerCase()) && !!seen.add(x.text.toLowerCase()));
  const t3f  = t3o.filter(x => !seen.has(x.text.toLowerCase()) && !!seen.add(x.text.toLowerCase()));

  return [...t1o, ...t2f, ...t3f];
}

// ════════════════════════════════════════════
//  FIT TAGS TO EXACTLY 500 YOUTUBE CHARS
//  Uses ytCharCount() which matches YouTube's counter precisely.
// ════════════════════════════════════════════

function fitTo500(tagObjs) {
  const LIMIT = 500;
  const result  = [];
  const seen    = new Set();

  for (const obj of tagObjs) {
    const t   = obj.text.trim().normalize('NFC');
    const key = t.toLowerCase();
    if (seen.has(key) || t.length < 2) continue;

    // Simulate adding this tag and measure the resulting string length
    const candidate = [...result.map(o => o.text), t];
    if (ytCharCount(candidate) > LIMIT) continue;

    result.push({ ...obj, text: t });
    seen.add(key);
  }

  return { tags: result, charCount: ytCharCount(result.map(o => o.text)) };
}

// ════════════════════════════════════════════
//  HASHTAG BUILDER
// ════════════════════════════════════════════

const HASHTAG_POOL = [
  '#SieuXeVietNam','#PhucCheXe','#PhucHoiXe','#CarRestoration',
  '#BeforeAfter','#RestoreCar','#CarRebuild','#JunkToSupercar',
  '#XeVietNam','#SieuXe','#DoXe','#XeCo',
  '#SalvageCar','#PhucCheXeVietNam','#AbandonedCarRestoration',
  '#XePheLieu','#DoXeMay','#XeMayCo','#GaraViet','#VietNamCar',
  '#CarTransformation','#RustedCarRestoration','#OldCarRestore',
  '#XeMay','#MotorbikeRestoration','#XeMayVietNam',
];

function buildHashtags(tagObjs, n) {
  const pool = [];

  // Dynamic: top tier-1 tags → CamelCase
  for (const obj of tagObjs.filter(o => o.tier === 1).slice(0, 5)) {
    const ht = '#' + deaccent(obj.text).split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    if (ht.length >= 4 && ht.length <= 32 && /^#[A-Za-z]/.test(ht)) pool.push(ht);
  }

  pool.push(...HASHTAG_POOL);

  const seen = new Set();
  return pool.filter(h => {
    const k = h.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, n);
}

// ════════════════════════════════════════════
//  TITLE SUGGESTION ENGINE
//  Returns 3 title options + 1 short description snippet each
// ════════════════════════════════════════════

function suggestTitles(title, topic) {
  const { brands, numbers } = extractEntities(title);
  const keyWords = scoreKeywords(title, topic).slice(0, 8).map(s => s.word);

  const mainBrand  = brands[0] || '';
  const mainBrandU = mainBrand ? titleCase(mainBrand) : '';

  const vals = title.match(/[\d.,]+\s*[\$₫%]|[\d.,]+\s*(tỷ|triệu|k|nghìn|đô la|dollar)/gi) || [];
  const lowVal  = vals[0] ? vals[0].trim() : '';
  const highVal = vals[1] ? vals[1].trim() : '';

  const isSupercar  = /siêu xe|supercar|lamborghini|ferrari|pagani|bugatti|mclaren|koenigsegg|porsche|aventador|huracan/i.test(title + ' ' + topic);
  const isMotorbike = /xe máy|motorbike|honda|yamaha|suzuki|kawasaki/i.test(title + ' ' + topic);
  const vLabel      = isSupercar ? 'Siêu Xe' : isMotorbike ? 'Xe Máy' : 'Xe';

  const ACTIONS = ['Phục Chế','Phục Hồi','Hồi Sinh','Tái Sinh','Biến Hình','Độ','Cứu Sống'];
  const act = ACTIONS.find(a => title.toUpperCase().includes(a.toUpperCase())) || 'Phục Chế';

  const bStr    = mainBrandU ? mainBrandU + ' ' : '';
  const fromStr = lowVal  ? `Chỉ ${lowVal}`  : 'Từ Đống Phế Liệu';
  const toStr   = highVal ? `${highVal}`      : 'Đỉnh Cao';

  // Title templates — 9 formulas
  const titleTemplates = [
    `${act} ${bStr}${vLabel} Rỉ Sét ${fromStr} — Kết Quả Khiến Triệu Người Không Tin! 🔥`,
    `Từ ${bStr}${vLabel} Bỏ Hoang ${fromStr} → ${toStr} | Hành Trình ${act} Đỉnh Nhất VN`,
    `Liệu Có Thể ${act} ${bStr}${vLabel} Từ Phế Liệu? ${fromStr} — Thử Thách Không Thể Bỏ Qua! 😱`,
    lowVal && highVal
      ? `Bỏ ${lowVal} ${act} ${bStr}${vLabel} — Thu Về ${highVal} | Siêu Lợi Nhuận Không Tưởng! 💰`
      : `${act} ${bStr}${vLabel} Cũ Nát Thành Siêu Phẩm — Bí Quyết Không Ai Dạy Bạn! 🚀`,
    `Cách ${act} ${bStr}${vLabel} Rỉ Sét Từ A-Z | Chi Tiết Nhất Việt Nam | ${topic}`,
    `${bStr}${vLabel} Bị Bỏ Hoang ${lowVal ? lowVal + ' ' : ''}Không Ai Muốn — Tôi ${act} Và Điều Kỳ Diệu Xảy Ra! ⚡`,
    `${act} ${bStr}${vLabel}${lowVal ? ' ' + lowVal : ''} Đẹp Như Xe Mới${highVal ? ' — Giá Trị ' + highVal : ''} | Đỉnh Nhất ${new Date().getFullYear()}!`,
    `Bạn Sẽ Không Nhận Ra Đây Là ${vLabel} Cũ — ${act} ${bStr}Từ Đống Rỉ Sét! 🏆`,
    `Hành Trình ${act} ${bStr}${vLabel}${lowVal ? ' ' + lowVal : ''} — Câu Chuyện Không Thể Tin Được!`,
  ];

  // Description snippets matching each title template
  const descTemplates = [
    `Xem toàn bộ quá trình ${act.toLowerCase()} ${bStr.trim() || vLabel} từ đống rỉ sét thành siêu phẩm${highVal ? ` trị giá ${highVal}` : ''}. Kỹ thuật chi tiết, không cắt cảnh.`,
    `Hành trình biến ${bStr.trim() || vLabel} bỏ hoang${lowVal ? ` (${lowVal})` : ''} thành xe đỉnh. Từng bước ${act.toLowerCase()} được quay chi tiết, kèm chi phí thực tế.`,
    `Thử thách ${act.toLowerCase()} ${bStr.trim() || vLabel} từ phế liệu${lowVal ? ` chỉ ${lowVal}` : ''}. Liệu có thể làm được? Xem kết quả cuối video để biết sự thật!`,
    lowVal && highVal
      ? `Chi phí bỏ ra: ${lowVal}. Giá trị sau khi ${act.toLowerCase()}: ${highVal}. Toàn bộ bí quyết trong video này.`
      : `Hướng dẫn ${act.toLowerCase()} ${bStr.trim() || vLabel} cũ nát thành siêu phẩm. Kỹ thuật từ A-Z, dễ học, chi phí thấp.`,
    `Hướng dẫn chi tiết từng bước ${act.toLowerCase()} ${bStr.trim() || vLabel} rỉ sét. Phù hợp cho người mới học. Công cụ, vật liệu và kỹ thuật đều có trong video.`,
    `${bStr.trim() || vLabel} bị bỏ hoang${lowVal ? `, mua với giá ${lowVal}` : ''}. Tôi đã ${act.toLowerCase()} và đây là kết quả bất ngờ. Đừng bỏ lỡ phần reveal cuối video!`,
    `${act} ${bStr.trim() || vLabel}${lowVal ? ' ' + lowVal : ''} trở thành xe đẹp như mới${highVal ? `, giá trị ${highVal}` : ''}. Xem ngay để học kỹ thuật này!`,
    `Từ ${vLabel} rỉ sét toàn thân${lowVal ? ` (${lowVal})` : ''} → xe hoàn toàn mới. Quá trình ${act.toLowerCase()} đầy đủ không cắt cảnh, dài ${Math.floor(Math.random()*20+15)} phút.`,
    `Câu chuyện ${act.toLowerCase()} ${bStr.trim() || vLabel}${lowVal ? ' ' + lowVal : ''} từ đống phế liệu. Mỗi chi tiết đều được ghi lại cẩn thận — từ lúc bắt đầu đến lúc hoàn thiện.`,
  ];

  function scoreTitle(t) {
    let s = 0;
    const len = t.length;
    if (len >= 50 && len <= 90) s += 4;
    else if (len >= 40 && len <= 100) s += 2;
    if (/\d/.test(t)) s += 2;
    if (/[🔥😱🚀💥⚡🏆💰]/.test(t)) s += 1.5;
    if (/\?/.test(t)) s += 1.5;
    if (/→|—/.test(t)) s += 2;
    if (mainBrandU && t.includes(mainBrandU)) s += 3;
    if (lowVal && t.includes(lowVal)) s += 2;
    if (highVal && t.includes(highVal)) s += 2;
    keyWords.forEach(w => {
      if (deaccent(t.toLowerCase()).includes(deaccent(w))) s += 0.4;
    });
    return s;
  }

  const sorted = titleTemplates
    .map((t, i) => ({ title: t.trim(), desc: descTemplates[i].trim(), score: scoreTitle(t) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const usedPfx = new Set();
  for (const item of sorted) {
    const pfx = item.title.slice(0, 28).toLowerCase();
    if (!usedPfx.has(pfx)) {
      usedPfx.add(pfx);
      picked.push(item);
    }
    if (picked.length === 3) break;
  }

  return picked; // [{title, desc, score}, ...]
}

// ════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════

function updateMeter(charCount) {
  const bar = document.getElementById('charBar');
  const num = document.getElementById('charNum');
  const pct = Math.min(100, (charCount / 500) * 100);
  bar.style.width = pct + '%';
  const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
  bar.className = 'char-bar' + (cls ? ' ' + cls : '');
  num.className = 'char-num' + (cls ? ' ' + cls : '');
  num.textContent = `${charCount} / 500`;
}

function renderTitleSuggestions(suggestions) {
  const container = document.getElementById('titleSuggestions');
  const block     = document.getElementById('titleSuggestBlock');

  container.innerHTML = suggestions.map((item, i) => `
    <div class="title-suggestion" id="sug-${i}">
      <div class="sug-meta">
        <span class="sug-label">✦ Đề xuất ${i + 1}</span>
        <span class="sug-len">${item.title.length} ký tự</span>
      </div>
      <div class="sug-text">${item.title}</div>
      <div class="sug-desc">📝 ${item.desc}</div>
      <button class="btn-use-title" onclick="useTitle(${i})">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Dùng tiêu đề này → cập nhật tags
      </button>
    </div>
  `).join('');

  block.style.display = 'block';
  window._suggestions = suggestions;
}

function useTitle(idx) {
  const item = window._suggestions[idx];
  document.getElementById('title').value = item.title;

  document.querySelectorAll('.title-suggestion').forEach((el, i) => {
    el.classList.toggle('chosen', i === idx);
  });

  generate(true);
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ════════════════════════════════════════════
//  MAIN GENERATE
// ════════════════════════════════════════════

function generate(skipSuggestions = false) {
  const title = document.getElementById('title').value.trim();
  const topic = document.getElementById('topic').value.trim();
  if (!title || !topic) {
    alert('Vui lòng nhập đủ tiêu đề và chủ đề!');
    return;
  }

  // ── Tags ──
  const allTags = buildTags(title, topic);
  const { tags: fitted, charCount } = fitTo500(allTags);

  document.getElementById('tagsPills').innerHTML = fitted.map(obj => {
    const cls = obj.tier === 1 ? 'tier1' : obj.tier === 2 ? 'tier2' : '';
    return `<div class="tag-pill ${cls}">${obj.text}</div>`;
  }).join('');
  document.getElementById('tagCount').textContent = fitted.length;
  updateMeter(charCount);

  lastTagsVal = fitted.map(o => o.text).join(', ');
  document.getElementById('tagsPaste').textContent = lastTagsVal;

  // ── Hashtags ──
  const hashtags = buildHashtags(fitted, numHash);
  document.getElementById('hashPills').innerHTML = hashtags.map(h =>
    `<div class="tag-pill hashtag">${h}</div>`
  ).join('');
  document.getElementById('hashCount').textContent = hashtags.length;
  lastHashVal = hashtags.join(' ');
  document.getElementById('hashPaste').textContent = lastHashVal;

  // ── Title suggestions ──
  if (!skipSuggestions) {
    renderTitleSuggestions(suggestTitles(title, topic));
  }

  const res = document.getElementById('results');
  res.classList.add('show');
  if (!skipSuggestions) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Copy helpers ──
function copyTags() {
  navigator.clipboard.writeText(lastTagsVal).then(() => flashBtn('copyTagsBtn'));
}
function copyHash() {
  navigator.clipboard.writeText(lastHashVal).then(() => flashBtn('copyHashBtn'));
}
function flashBtn(id) {
  const btn = document.getElementById(id);
  btn.classList.add('copied');
  btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> COPIED!`;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> COPY ALL`;
  }, 2200);
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') generate();
});
