// ════════════════════════════════════════════════════════
//  YouTube SEO Generator — app.js  v4
//  Universal engine — không hardcode niche
//  Đếm đúng YouTube: tags.join(', ').normalize('NFC').length ≤ 500
// ════════════════════════════════════════════════════════
'use strict';

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

// Chuẩn hóa: lowercase, bỏ ký tự đặc biệt
function clean(s) {
  return s.toLowerCase().trim()
    .replace(/[|\/\\,!?@#%^*()\[\]{}"'<>~`=+\-–—]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// TitleCase an toàn tiếng Việt — dùng toLocaleUpperCase('vi')
function tc(s) {
  return String(s || '').trim().split(/\s+/).map(w => {
    const pts = [...w];
    if (!pts.length) return '';
    return pts[0].toLocaleUpperCase('vi') + pts.slice(1).join('');
  }).join(' ');
}

function uniq(arr) {
  const seen = new Set();
  return arr.filter(x => {
    const k = (typeof x === 'string' ? x : x.text).toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// Đếm ký tự đúng YouTube
function ytLen(tags) {
  return tags.length ? tags.join(', ').normalize('NFC').length : 0;
}

// ════════════════════════════════════════════
//  STOPWORDS
// ════════════════════════════════════════════

const STOP = new Set([
  'từ','và','hay','là','đến','vào','của','trong','trở','thành','để','với',
  'một','các','có','không','được','cho','khi','sau','trên','dưới','này','đó',
  'đây','qua','về','ra','lên','xuống','lại','bởi','ở','rồi','nên','mà',
  'nhưng','còn','thì','đã','sẽ','đang','bị','như','theo','cùng','hoặc',
  'tôi','bạn','anh','chị','họ','mình','tất','rất','quá','hơn','nhất',
  'the','a','an','to','of','in','on','at','by','for','as','is','it','its',
  'was','are','be','been','with','that','this','from','or','but','not',
  'and','all','also','can','has','have','had','do','did','will','would',
  'my','your','his','her','our','we','they','you','i','me','so','if',
  'just','more','very','much','how','what','when','where','who','only',
  'into','over','after','before','about','than','even','there','been',
]);

// ════════════════════════════════════════════
//  ACTION DETECTION
//  Danh sách cụm dài trước (greedy match)
//  Phát hiện động từ chính trong title
// ════════════════════════════════════════════

const ACTION_PATTERNS = [
  // Tiếng Việt — cụm 3 từ trước
  'làm thế nào','cách làm thế','từ a đến z','từ a-z',
  // Tiếng Việt — cụm 2 từ
  'phục chế','phục hồi','hồi sinh','tái sinh','biến hình','cứu sống',
  'chế tạo','thiết kế','hướng dẫn','so sánh','đánh giá','khám phá',
  'trải nghiệm','chia sẻ','xây dựng','tạo ra','cách làm','bí quyết',
  'học cách','tập luyện',
  // Tiếng Việt — 1 từ
  'làm','nấu','dạy','học','sửa','xây','lắp','vẽ','tập','đầu','độ','tạo',
  // Tiếng Anh — cụm
  'how to','step by step','from scratch','before and after',
  'restore','rebuild','transform','revive','rescue','convert','turn into',
  'build','make',
  'create','cook','teach','design','draw','hack','mod','craft',
  'explore','compare','fix','turn','convert','review',
];

function detectAction(title) {
  const tl = title.toLowerCase();
  // Tìm action xuất hiện sớm nhất, tie-break: chọn dài hơn
  let best = '', bestPos = Infinity;
  for (const a of ACTION_PATTERNS) {
    const pos = tl.indexOf(a);
    if (pos === -1) continue;
    if (pos < bestPos || (pos === bestPos && a.length > best.length)) {
      best = a; bestPos = pos;
    }
  }
  // Fallback: từ đầu tiên có ý nghĩa (≥3 ký tự, không phải số, không stop)
  if (!best) {
    for (const w of title.split(/\s+/)) {
      const wl = [...w].map(c=>c.toLowerCase()).join('').replace(/[^a-záàâãèéêìíòóôõùúýăđơư]/gi,'');
      if (wl.length >= 3 && !STOP.has(wl) && !/^\d/.test(w)) {
        best = wl; break;
      }
    }
  }
  return best;
}

// ════════════════════════════════════════════
//  BRAND/PROPER NOUN DETECTION
//  Chỉ nhận danh từ riêng Latin thuần (Pagani, iPhone, Mazda...)
//  KHÔNG nhận: common English words, action verbs, words có dấu Việt
// ════════════════════════════════════════════

const COMMON_WORDS = new Set([
  'Turned','Salvage','Dream','Build','Make','Create','From','Into','With',
  'Test','Game','Games','Gaming','Play','Show','Video','Watch','Best','Good','Real','True',
  'Full','Only','Just','Very','More','Most','Some','Many','Much','Every',
  'After','Before','About','Between','Using','Getting','Making','Going',
  'Part','Time','Work','Home','Life','Days','Week','Year','Month','Money',
  'That','This','Which','Where','When','What','Have','Does','They','Been',
  'Phone','Laptop','Computer','Budget','Result','Profit','Challenge','Series',
]);

function detectBrands(title) {
  // Chỉ lấy từ phần đầu (trước dấu |) để tránh nhận tên phụ
  const mainPart = title.split('|')[0];
  // Thêm blacklist tính từ/danh từ phổ thông tiếng Anh hay bị nhận nhầm
  const ADJ_BLACKLIST = new Set([
    'Ngon','Trai','Gai','Dep','Xau','Moi','Hay','Tot','Kho','Easy','Hard',
    'Fast','Slow','Best','Good','Real','True','Full','Long','Short','High',
    'Free','Last','Next','Past','Late','Early','Deep','Wide','Dark','Bright',
    'Fresh','Clean','Clear','Smart','Quick','Cheap','Rich','Poor','Old','New',
  ]);
  return mainPart.split(/[\s,\-–—\/\\()+]+/).filter(t =>
    t.length >= 5 &&                                              // ≥5 ký tự
    /^[A-Z][a-z]{2,}/.test(t) &&                                 // PascalCase
    !/[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹ]/i.test(t) &&
    !COMMON_WORDS.has(t) &&
    !ADJ_BLACKLIST.has(t) &&
    !STOP.has(t.toLowerCase()) &&
    !ACTION_PATTERNS.includes(t.toLowerCase())
  );
}

// ════════════════════════════════════════════
//  VALUE EXTRACTION (giá tiền, số liệu)
// ════════════════════════════════════════════

function detectValues(text) {
  const matches = text.match(
    /\$[\d.,]+|\€[\d.,]+|[\d.,]+\s*[\$₫€£%]|[\d.,]+\s*(tỷ|triệu|nghìn|ngàn|đô|dollar|usd|k\b|tỉ|kg|km|lần|tháng|năm)/gi
  ) || [];
  return [...new Set(matches.map(v => v.trim()))];
}

// ════════════════════════════════════════════
//  LANGUAGE DETECTION
// ════════════════════════════════════════════

function detectLang(text) {
  const viCount = (text.match(/[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹ]/gi)||[]).length;
  return viCount / Math.max(text.replace(/\s/g,'').length, 1) > 0.04 ? 'vi' : 'en';
}

// ════════════════════════════════════════════
//  TF-IDF KEYWORD SCORING
// ════════════════════════════════════════════

function scoreKw(title, topic) {
  const titleC = clean(title);
  const topicC = clean(topic);
  // Topic lặp 3 lần để boost weight
  const corpus = `${topicC} ${topicC} ${topicC} ${titleC}`;
  const tokens = corpus.split(/\s+/).filter(w => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));

  const freq = {};
  tokens.forEach((w, i) => {
    if (!freq[w]) freq[w] = { count: 0, firstPos: i };
    freq[w].count++;
  });

  const total = tokens.length || 1;
  return Object.entries(freq).map(([word, d]) => {
    const tf         = d.count / total;
    const lenBonus   = Math.min(word.length / 5, 2.5);
    const posBonus   = Math.max(1.5 - d.firstPos / total, 0.5);
    const topicBoost = topicC.split(/\s+/).includes(word) ? 4 : 1;
    return { word, score: tf * lenBonus * posBonus * topicBoost };
  }).sort((a, b) => b.score - a.score);
}

// ════════════════════════════════════════════
//  SMART N-GRAM EXTRACTION
//  Chỉ lấy ngram CÓ Ý NGHĨA:
//  - Không bắt đầu/kết thúc bằng stopword
//  - Không chứa toàn stop words
//  - Độ dài hợp lý
// ════════════════════════════════════════════

function smartNgrams(text, minN, maxN) {
  const words = clean(text).split(/\s+/).filter(w => w.length > 0);
  // Từ đơn tiếng Việt chỉ có nghĩa trong cụm, không standalone
  const WEAK_ALONE = new Set([
    'hồi','sinh','chế','tạo','dựng','lắp','ăn','uống','tư','đầu',
    'chứng','khoán','cơ','bắp','thể','hình','dục','trình','diễn',
  ]);
  const result = [];
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n);
      // Bỏ ngram nếu từ đầu hoặc từ cuối là stopword hoặc weak-alone
      if (STOP.has(gram[0]) || STOP.has(gram[gram.length - 1])) continue;
      if (n === 2 && (WEAK_ALONE.has(gram[0]) || WEAK_ALONE.has(gram[1]))) continue;
      // Bỏ ngram nếu có stopword ở giữa
      if (gram.length >= 2 && gram.slice(1, -1).some(w => STOP.has(w))) continue;
      // Bỏ ngram nếu chứa toàn stopwords
      if (gram.every(w => STOP.has(w))) continue;
      // Bỏ ngram nếu có pure number
      if (gram.some(w => /^\d+$/.test(w))) continue;
      const phrase = gram.join(' ');
      if (phrase.length >= 3 && phrase.length <= 50) result.push(phrase);
    }
  }
  return result;
}

// ════════════════════════════════════════════
//  MAIN TAG BUILDER
// ════════════════════════════════════════════

function buildTags(title, topic) {
  const titleC  = clean(title);
  const topicC  = clean(topic);
  const lang    = detectLang(title + ' ' + topic);
  const isVi    = lang === 'vi';

  const action  = detectAction(title);
  const brands  = detectBrands(title);
  const values  = detectValues(title + ' ' + topic);
  const scored  = scoreKw(title, topic);
  const topKws  = scored.slice(0, 15).map(s => s.word);

  // Geo + quality modifiers — dynamic theo ngôn ngữ
  const geo      = isVi ? ['việt nam', 'vn'] : ['vietnam', 'vn'];
  const quality  = isVi
    ? ['hướng dẫn', 'chi tiết', 'cho người mới', 'từ a đến z', 'mới nhất']
    : ['tutorial', 'guide', 'for beginners', 'step by step', 'how to'];
  const temporal = [`${new Date().getFullYear()}`];

  const t1 = [], t2 = [], t3 = [];

  // ── TIER 1: Exact-match, highest SEO signal ──

  // 1a. Topic chính xác — YouTube ưu tiên đây nhất
  t1.push(topicC);

  // 1b. Smart ngrams từ topic (trigram + bigram)
  t1.push(...smartNgrams(topic, 2, 3));

  // 1c. Smart ngrams từ title — bigram + trigram chọn lọc
  const titleNgrams = smartNgrams(title, 2, 3);
  // Chỉ lấy ngrams có overlap với topKws
  const relevantNgrams = titleNgrams.filter(ng =>
    ng.split(' ').some(w => topKws.includes(w) || topicC.includes(w))
  );
  t1.push(...relevantNgrams.slice(0, 10));

  // 1d. Brand + topic combos
  for (const b of brands.slice(0, 3)) {
    const bl = b.toLowerCase();
    t1.push(bl);
    t1.push(`${bl} ${topicC}`);
    t1.push(`${topicC} ${bl}`);
  }

  // 1e. Action + top keywords (chỉ khi action không trùng topic)
  if (action && !topicC.includes(action)) {
    for (const w of topKws.slice(0, 5)) {
      if (w !== action && w.length > 2) t1.push(`${action} ${w}`);
    }
  }

  // 1f. Topic + top keywords (topic prefix)
  for (const w of topKws.slice(0, 6)) {
    if (!topicC.split(' ').includes(w) && w.length > 2) {
      t1.push(`${topicC} ${w}`);
    }
  }

  // 1g. Value combos
  for (const v of values.slice(0, 2)) {
    const vc = clean(v);
    if (vc) t1.push(`${topicC} ${vc}`);
  }

  // ── TIER 2: Long-tail semantic expansion ──

  // 2a. Topic + quality modifiers
  for (const q of quality) t2.push(`${topicC} ${q}`);

  // 2b. Topic + geo
  for (const g of geo) t2.push(`${topicC} ${g}`);

  // 2c. Top keywords + geo
  for (const w of topKws.slice(0, 4)) {
    if (w.length > 3) t2.push(`${w} ${geo[0]}`);
  }

  // 2d. Topic + temporal
  for (const t of temporal) t2.push(`${topicC} ${t}`);

  // 2e. Deaccented topic (reach EN searchers)
  const topicDa = deaccent(topicC);
  if (topicDa !== topicC) t2.push(topicDa);

  // 2f. Title segments (mỗi phần chia bởi |)
  const segs = title.split(/[|–—]/).map(s => clean(s)).filter(s => s.length >= 5 && s.length <= 55 && s !== topicC);
  t2.push(...segs.slice(0, 2));

  // ── TIER 3: Reach expansion ──

  // 3a. No-accent versions (search tiếng Anh)
  for (const t of [...t1].slice(0, 10)) {
    const na = deaccent(t);
    if (na !== t && na.length >= 3) t3.push(na);
  }

  // 3b. Single high-value keywords
  t3.push(...topKws.slice(0, 8));

  // 3c. Universal
  t3.push('youtube', ...geo);

  // ── Compile & dedup ──
  const mk = tier => s => ({ text: s.trim().normalize('NFC'), tier });
  const o1 = uniq(t1.map(mk(1))).filter(x => x.text.length >= 2);
  const o2 = uniq(t2.map(mk(2))).filter(x => x.text.length >= 2);
  const o3 = uniq(t3.map(mk(3))).filter(x => x.text.length >= 2);

  const seen = new Set(o1.map(x => x.text.toLowerCase()));
  const f2   = o2.filter(x => !seen.has(x.text.toLowerCase()) && !!seen.add(x.text.toLowerCase()));
  const f3   = o3.filter(x => !seen.has(x.text.toLowerCase()) && !!seen.add(x.text.toLowerCase()));

  return [...o1, ...f2, ...f3];
}

// ════════════════════════════════════════════
//  FIT TAGS TO 500 CHARS (YouTube exact)
// ════════════════════════════════════════════

function fitTo500(tagObjs) {
  const result = [], seen = new Set();
  for (const obj of tagObjs) {
    const t = obj.text.trim().normalize('NFC');
    const k = t.toLowerCase();
    if (seen.has(k) || t.length < 2) continue;
    if (ytLen([...result.map(o => o.text), t]) > 500) continue;
    result.push({ ...obj, text: t });
    seen.add(k);
  }
  return { tags: result, charCount: ytLen(result.map(o => o.text)) };
}

// ════════════════════════════════════════════
//  HASHTAG BUILDER (dynamic)
// ════════════════════════════════════════════

function buildHashtags(tagObjs, title, topic, n) {
  const lang    = detectLang(title + ' ' + topic);
  const topicC  = clean(topic);
  const brands  = detectBrands(title);
  const topKws  = scoreKw(title, topic).slice(0, 10).map(s => s.word);
  const pool    = [];

  // Từ tier-1 tags → CamelCase
  for (const obj of tagObjs.filter(o => o.tier === 1).slice(0, 8)) {
    const ht = '#' + deaccent(obj.text).split(/\s+/)
      .filter(w => w.length > 1)
      .map(w => w[0].toUpperCase() + w.slice(1)).join('');
    if (ht.length >= 3 && ht.length <= 35 && /^#[A-Za-z]/.test(ht)) pool.push(ht);
  }

  // Topic hashtag
  const topHt = '#' + deaccent(topicC).split(/\s+/)
    .map(w => w[0].toUpperCase() + w.slice(1)).join('');
  if (topHt.length >= 3 && topHt.length <= 35) pool.push(topHt);
  const geoHt = topHt + (lang === 'vi' ? 'VietNam' : 'Vietnam');
  if (geoHt.length <= 35) pool.push(geoHt);

  // Brand hashtags
  for (const b of brands.slice(0, 3)) {
    if ('#' + b.length <= 35) pool.push('#' + b);
  }

  // Top keyword hashtags
  for (const w of topKws.slice(0, 5)) {
    if (w.length >= 3) {
      const ht = '#' + deaccent(w)[0].toUpperCase() + deaccent(w).slice(1);
      if (/^#[A-Za-z]/.test(ht) && ht.length <= 30) pool.push(ht);
    }
  }

  pool.push('#YouTube', '#VietNam', '#Vietnam');

  const seen = new Set();
  return pool.filter(h => {
    const k = h.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, n);
}

// ════════════════════════════════════════════
//  TITLE SUGGESTION ENGINE
//
//  Logic xây dựng mainPhrase không lặp từ:
//  1. action  = động từ chính (phục hồi, build, nấu...)
//  2. subject = brand Latin nếu có, không thì topic
//  3. Nếu subject ĐÃ CHỨA action → mainPhrase = subject (không thêm action)
//  4. Nếu subject LÀ topic và topic chứa action → mainPhrase = topic
//  5. Chỉ ghép "action subject" khi 2 thứ thực sự khác nhau
//
//  3 góc độ cố định: Shock | How-to | Before/After
// ════════════════════════════════════════════

// Kiểm tra giá trị có phải tiền không (phân biệt "50 TỶ" vs "50kg")
function isMoneyVal(v) {
  return /\$|₫|€|£|tỷ|triệu|nghìn|ngàn|đô|dollar|usd|tỉ/i.test(v);
}

function suggestTitles(title, topic) {
  const lang   = detectLang(title + ' ' + topic);
  const isVi   = lang === 'vi';
  const action = detectAction(title);
  const brands = detectBrands(title);
  const values = detectValues(title + ' ' + topic);
  const kws    = scoreKw(title, topic).slice(0, 8).map(s => s.word);
  const year   = new Date().getFullYear();

  const val1 = values[0] || '';
  const val2 = values[1] || '';
  const brand = brands[0] || '';

  const actionTc  = tc(action || (isVi ? 'làm' : 'build'));
  const topicTc   = tc(topic);

  // Subject: brand Latin > topic
  const subjectRaw = brand ? brand : topic;
  const subjectTc  = tc(subjectRaw);

  // Kiểm tra action đã nằm trong subject chưa (deaccent để so sánh)
  const actionInSub = deaccent(subjectRaw.toLowerCase())
    .includes(deaccent((action || '').toLowerCase()));
  // Thêm check: topic bắt đầu bằng action → không ghép (tránh "Hướng Dẫn Hướng Dẫn...")
  const topicStartsWithAction = deaccent(clean(topic))
    .startsWith(deaccent((action || '').toLowerCase()));

  // mainPhrase: không lặp
  const mainPhraseTc = (actionInSub || topicStartsWithAction) ? subjectTc : `${actionTc} ${subjectTc}`;
  const mainPhraseL  = mainPhraseTc.toLowerCase();

  // VI templates
  const viSet = [
    {
      angle: 'shock',
      // isMoneyVal: chỉ dùng "Thu Về / Lợi Nhuận" khi val là tiền ($, tỷ, triệu, đô...)
      // Nếu val là kg, tháng, năm... → dùng "Kết Quả" thay thế
      title: (() => {
        const hasMoney1 = isMoneyVal(val1), hasMoney2 = isMoneyVal(val2);
        if (val1 && val2 && hasMoney1 && hasMoney2)
          return `${mainPhraseTc} Chỉ ${val1} — Thu Về ${val2} Lợi Nhuận Khủng! 🔥`;
        if (val1 && val2 && !hasMoney1 && !hasMoney2)
          return `${mainPhraseTc}: Từ ${val1} Lên ${val2} — Kết Quả Gây Sốc Hàng Triệu Người! 🔥`;
        if (val1)
          return `${mainPhraseTc} Với Vỏn Vẹn ${val1} — Kết Quả Ai Cũng Phải Bất Ngờ! 🔥`;
        return `${mainPhraseTc} Từ Con Số 0 — Kết Quả Gây Sốc Hàng Triệu Người! 🔥`;
      })(),
      desc: (() => {
        const hasMoney1=isMoneyVal(val1), hasMoney2=isMoneyVal(val2);
        if (val1 && val2 && hasMoney1 && hasMoney2)
          return `Chỉ bỏ ra ${val1}, thu về ${val2}. Toàn bộ quy trình không cắt cảnh — chi phí và kỹ thuật thực tế.`;
        if (val1 && val2)
          return `Bắt đầu từ ${val1}, đạt kết quả ${val2}. Xem toàn bộ hành trình ${mainPhraseL} trong video.`;
        if (val1)
          return `Với ${val1}, tôi đã ${mainPhraseL}. Xem toàn bộ quy trình thực tế không cắt cảnh.`;
        return `Toàn bộ hành trình ${mainPhraseL} từ đầu đến cuối. Không cắt cảnh, không bỏ sót bước nào.`;
      })(),
    },
    {
      angle: 'howto',
      // Tránh "Hướng Dẫn Hướng Dẫn..." khi action đã là "hướng dẫn"
      title: (() => {
        const prefix = deaccent((action||'').toLowerCase()).includes('huong dan') ? '' : 'Hướng Dẫn ';
        return val1
          ? `${prefix}${mainPhraseTc} Từ A–Z | Chỉ ${val1} | ${topicTc} ${year}`
          : `${prefix}${mainPhraseTc} Từ A–Z | Chi Tiết Nhất ${year} — Ai Cũng Làm Được!`;
      })(),
      desc: `Hướng dẫn từng bước ${mainPhraseL}${val1 ? ` với ngân sách chỉ ${val1}` : ''}. Đầy đủ kỹ thuật, công cụ và bí quyết thực chiến. Phù hợp cả người mới bắt đầu.`,
    },
    {
      angle: 'transform',
      title: val1 && val2
        ? `${subjectTc}: Từ ${val1} → ${val2} | Trước & Sau ${actionTc} | ${year} 🏆`
        : brand
          ? `${brand}: Trước & Sau Khi ${actionTc} — Sự Thay Đổi Không Thể Tin! ${year} 😱`
          : `Trước & Sau ${mainPhraseTc} — Biến Đổi Hoàn Toàn | ${topicTc} ${year} 😱`,
      desc: val1 && val2
        ? `So sánh trực quan trước và sau: bắt đầu ${val1}, kết quả ${val2}. Toàn bộ kỹ thuật ${mainPhraseL} chi tiết trong video.`
        : `Nhìn thấy sự thay đổi hoàn toàn sau khi ${mainPhraseL}. Hình ảnh trước và sau đều có trong video!`,
    },
  ];

  // EN templates
  const enSet = [
    {
      angle: 'shock',
      title: val1 && val2
        ? `${mainPhraseTc} for ${val1} — Flipped for ${val2}! Nobody Thought It Was Possible 🔥`
        : val1
          ? `${mainPhraseTc} With Only ${val1} — The Result Shocked Everyone! 🔥`
          : `${mainPhraseTc} From Scratch — The Result Nobody Believed Was Possible! 🔥`,
      desc: val1 && val2
        ? `Spent ${val1}, made ${val2}. Full uncut ${mainPhraseL} — real costs, real results.`
        : `Full ${mainPhraseL} journey from start to finish. No cuts, no skipped steps.`,
    },
    {
      angle: 'howto',
      title: val1
        ? `How to ${mainPhraseTc} for ${val1} — Complete A–Z Guide | ${topicTc} ${year}`
        : `How to ${mainPhraseTc} Step by Step — Complete ${year} Guide (Anyone Can Do This!)`,
      desc: `Step-by-step ${mainPhraseL}${val1 ? ` on a ${val1} budget` : ''}. All tools, techniques and pro tips. Perfect for beginners.`,
    },
    {
      angle: 'transform',
      title: val1 && val2
        ? `${subjectTc}: ${val1} → ${val2} | Before & After ${actionTc} | ${year} 🏆`
        : brand
          ? `${brand}: Before & After ${actionTc} — Unbelievable Transformation! ${year} 😱`
          : `Before & After ${mainPhraseTc} — Total Transformation | ${topicTc} ${year} 😱`,
      desc: val1 && val2
        ? `Visual before and after: started at ${val1}, ended at ${val2}. Full ${mainPhraseL} breakdown in video.`
        : `Complete transformation after ${mainPhraseL}. Before and after shots — judge for yourself!`,
    },
  ];

  function scoreTitle(t) {
    let s = 0;
    const len = [...t].length;
    if (len >= 55 && len <= 90)       s += 5;
    else if (len >= 40 && len <= 100) s += 2;
    if (/\d/.test(t))                 s += 2;
    if (/[🔥😱🚀💥⚡🏆💰]/.test(t)) s += 1.5;
    if (/→|—/.test(t))               s += 2;
    if (val1 && t.includes(val1))     s += 3;
    if (val2 && t.includes(val2))     s += 3;
    if (brand && t.includes(brand))   s += 2;
    kws.forEach(w => {
      if (deaccent(t.toLowerCase()).includes(deaccent(w))) s += 0.3;
    });
    return s;
  }

  return (isVi ? viSet : enSet)
    .map(item => ({ ...item, score: scoreTitle(item.title) }))
    .sort((a, b) => b.score - a.score);
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

const ANGLE_LABEL = {
  shock:     '⚡ Shock & Curiosity',
  howto:     '📖 How-to & Value',
  transform: '🔄 Before & After',
};

function renderTitleSuggestions(suggestions) {
  const container = document.getElementById('titleSuggestions');
  const block     = document.getElementById('titleSuggestBlock');

  container.innerHTML = suggestions.map((item, i) => `
    <div class="title-suggestion" id="sug-${i}">
      <div class="sug-meta">
        <span class="sug-label">${ANGLE_LABEL[item.angle] || '✦ Đề xuất ' + (i+1)}</span>
        <span class="sug-len">${[...item.title].length} ký tự</span>
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

  const hashtags = buildHashtags(fitted, title, topic, numHash);
  document.getElementById('hashPills').innerHTML = hashtags.map(h =>
    `<div class="tag-pill hashtag">${h}</div>`
  ).join('');
  document.getElementById('hashCount').textContent = hashtags.length;
  lastHashVal = hashtags.join(' ');
  document.getElementById('hashPaste').textContent = lastHashVal;

  if (!skipSuggestions) {
    renderTitleSuggestions(suggestTitles(title, topic));
  }

  const res = document.getElementById('results');
  res.classList.add('show');
  if (!skipSuggestions) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
