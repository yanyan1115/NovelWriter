// 重复检测（纯本地，不消耗 token）

// 更贴近“肉眼分句”的切分：
// - 强句界：句号/问号/感叹号/换行
// - 弱句界：逗号/分号/冒号/顿号/破折号/引号闭合等
// 同时过滤过短片段，避免“逗号太多导致句子过碎”误判。
const splitSentences = (text, opts = {}) => {
  const {
    // 低于该长度的片段会被丢弃/合并（避免把“啊”“嗯”之类当句子）
    minLen = 6,
    // 最多返回多少句（用于 early-echo 检测，避免太重）
    cap = 60,
  } = opts;

  const s0 = (text || '').trim();
  if (!s0) return [];

  // 统一换行
  let s = s0.replace(/\r\n?/g, '\n');

  // 将“——”视为弱句界
  s = s.replace(/——+/g, '——\n');

  // 强句界：句末标点或换行
  // 弱句界：，；：、 以及引号后紧跟的空白/换行
  const parts = s
    .split(/(?<=[。！？!?\n，；：、])\s*/)
    .map(x => x.trim())
    .filter(Boolean);

  // 合并/过滤过短片段
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    if (p.length < minLen) {
      // 尝试并入上一句
      if (out.length > 0) {
        out[out.length - 1] += p;
      }
      continue;
    }
    out.push(p);
    if (out.length >= cap) break;
  }

  return out;
};

// 计算重复句子比例（句子完全相同视为重复）
export const analyzeRepetition = (text) => {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return { sentenceCount: 0, dupSentenceCount: 0, dupSentenceRatio: 0, maxConsecutiveDup: 0 };
  }

  const seen = new Map();
  let dup = 0;
  let maxConsec = 0;
  let consec = 0;

  let prev = null;
  for (const sent of sentences) {
    const key = sent;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count >= 2) dup += 1;

    if (prev !== null && key === prev) {
      consec += 1;
      if (consec > maxConsec) maxConsec = consec;
    } else {
      consec = 0;
    }
    prev = key;
  }

  return {
    sentenceCount: sentences.length,
    dupSentenceCount: dup,
    dupSentenceRatio: sentences.length > 0 ? dup / sentences.length : 0,
    maxConsecutiveDup: maxConsec,
  };
};

export const shouldAutoRetryForRepetition = (rep, opts = {}) => {
  const {
    dupSentenceRatioThreshold = 0.22,
    maxConsecutiveDupThreshold = 1,
    minSentenceCount = 6,
  } = opts;

  if (!rep || rep.sentenceCount < minSentenceCount) return false;
  if (rep.maxConsecutiveDup >= maxConsecutiveDupThreshold) return true;
  if (rep.dupSentenceRatio >= dupSentenceRatioThreshold) return true;
  return false;
};

// --- 与上文“照抄/高度相似”检测（适合“从开头就开始复读/照抄”） ---

const normalizeForSim = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, '')
    // 去掉常见标点（保留文字骨架），提高对“照抄/仿写”的命中率
    .replace(/[，。！？：；、,.!?;:\-—\[\]\(\)（）“”"'《》<>]/g, '')
    .toLowerCase();
};

const ngramSet = (text, n = 12, maxGrams = 5000) => {
  const s = normalizeForSim(text);
  const set = new Set();
  if (s.length < n) return set;
  for (let i = 0; i <= s.length - n && set.size < maxGrams; i++) {
    set.add(s.slice(i, i + n));
  }
  return set;
};

const jaccard = (a, b) => {
  if (!a || !b || a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) {
    if (big.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
};

// 句子级“完全一致”检测：更贴合“逗号也算一句、6句一模一样”
export const analyzeExactSentenceEcho = (candidate, historyTexts = [], opts = {}) => {
  const {
    minCandidateSentences = 6,
    historyMax = 3,
    candidateSentenceCap = 20,
    splitOpts = { minLen: 6, cap: 80 },
  } = opts;

  const candSents = splitSentences(candidate, splitOpts).slice(0, candidateSentenceCap);
  if (candSents.length < minCandidateSentences) {
    return { checked: 0, candSentenceCount: candSents.length, bestExactCount: 0, bestExactRatio: 0, bestLongestConsecutive: 0 };
  }

  const list = (historyTexts || []).filter(Boolean).slice(-historyMax);

  let bestExactCount = 0;
  let bestExactRatio = 0;
  let bestLongestConsecutive = 0;
  let checked = 0;

  for (const h of list) {
    const hSents = splitSentences(h, splitOpts);
    if (hSents.length === 0) continue;
    checked += 1;

    const hSet = new Set(hSents);

    let exactCount = 0;
    for (const s of candSents) {
      if (hSet.has(s)) exactCount += 1;
    }
    const exactRatio = candSents.length > 0 ? exactCount / candSents.length : 0;

    let longest = 0;
    let cur = 0;
    for (let i = 0; i < candSents.length; i++) {
      const s = candSents[i];
      if (hSet.has(s)) {
        cur += 1;
        if (cur > longest) longest = cur;
      } else {
        cur = 0;
      }
    }

    if (exactCount > bestExactCount) bestExactCount = exactCount;
    if (exactRatio > bestExactRatio) bestExactRatio = exactRatio;
    if (longest > bestLongestConsecutive) bestLongestConsecutive = longest;
  }

  return {
    checked,
    candSentenceCount: candSents.length,
    bestExactCount,
    bestExactRatio: Number(bestExactRatio.toFixed(4)),
    bestLongestConsecutive,
  };
};

export const analyzeEchoSimilarity = (candidate, historyTexts = [], opts = {}) => {
  const {
    n = 12,
    minCandidateLen = 200,
    historyMax = 6,
  } = opts;

  const cand = candidate || '';
  if (cand.length < minCandidateLen) {
    return { checked: 0, bestScore: 0, bestIndex: -1 };
  }

  const candSet = ngramSet(cand, n);
  const list = (historyTexts || []).filter(Boolean).slice(-historyMax);

  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < list.length; i++) {
    const hs = list[i];
    const hSet = ngramSet(hs, n);
    const score = jaccard(candSet, hSet);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return { checked: list.length, bestScore, bestIndex };
};

export const shouldAbortEarlyForEcho = (echo, opts = {}) => {
  const {
    threshold = 0.10,
    minChecked = 1,
  } = opts;

  if (!echo) return false;
  if (echo.checked < minChecked) return false;
  return echo.bestScore >= threshold;
};

export const shouldAbortEarlyForExactEcho = (exact, opts = {}) => {
  const {
    minExactRatio = 0.35,
    minExactCount = 3,
    minLongestConsecutive = 2,
  } = opts;

  if (!exact || exact.checked <= 0) return false;
  if (exact.bestExactCount >= minExactCount) return true;
  if (exact.bestExactRatio >= minExactRatio) return true;
  if (exact.bestLongestConsecutive >= minLongestConsecutive) return true;
  return false;
};

// === 新增：首段“照抄片段”硬检测（不依赖分句，对标点差异更鲁棒）===
// 思路：把 candidate 前缀（600~1200字）与 history 前缀做归一化后，做滑窗子串匹配：
// - 若 candidate 中存在长度 >= minMatchLen 的片段，在任一 history 中完全出现，则判为照抄。
// 这专杀“开头一大段一字不改/大段相同”。
export const analyzeSubstringEcho = (candidate, historyTexts = [], opts = {}) => {
  const {
    candidateMaxLen = 1200,
    historyMaxLen = 1200,
    historyMax = 3,
    // 60~90 之间一般很稳；越小越容易误报“常见套话”
    minMatchLen = 80,
    // 步长越小越敏感但更耗；对 1200 字前缀，step=6 很轻
    step = 6,
    // 归一化：去空白 + 统一引号/破折号 + 可选去标点
    stripPunct = true,
    // 最多检查多少个窗口，兜底避免极端长文本卡 UI
    maxWindows = 6000,
  } = opts;

  const norm = (s) => {
    let x = String(s || '').replace(/\s+/g, '');
    // 统一常见全角/半角引号
    x = x.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    // 统一破折号
    x = x.replace(/—+/g, '—').replace(/-+/g, '-');
    if (stripPunct) {
      // 去掉绝大多数标点，避免“标点差一点导致漏检”
      x = x.replace(/[，。！？：；、,.!?;:…·\[\]\(\)（）“”"'《》<>【】]/g, '');
    }
    return x;
  };

  const candRaw = (candidate || '').slice(0, candidateMaxLen);
  const cand = norm(candRaw);
  if (!cand || cand.length < minMatchLen) {
    return { checked: 0, hit: false, bestMatchLen: 0, bestHistoryIndex: -1, windowsChecked: 0 };
  }

  const historyList = (historyTexts || []).filter(Boolean).slice(-historyMax).map(h => norm(String(h).slice(0, historyMaxLen)));
  const usable = historyList.filter(h => h && h.length >= minMatchLen);
  if (usable.length === 0) {
    return { checked: 0, hit: false, bestMatchLen: 0, bestHistoryIndex: -1, windowsChecked: 0 };
  }

  // 预先把 history 放进集合加速 contains：这里直接用 includes（JS 内部是优化过的）
  let windowsChecked = 0;
  let bestMatchLen = 0;
  let bestHistoryIndex = -1;

  for (let i = 0; i <= cand.length - minMatchLen; i += step) {
    const sub = cand.slice(i, i + minMatchLen);
    windowsChecked += 1;
    if (windowsChecked > maxWindows) break;

    for (let hi = 0; hi < usable.length; hi++) {
      const h = usable[hi];
      const pos = h.indexOf(sub);
      if (pos !== -1) {
        // 命中后尝试扩展匹配长度（贪心扩到最长）
        let maxExtend = minMatchLen;
        const maxPossible = Math.min(cand.length - i, h.length - pos);
        // 线性扩展：minMatchLen 本来不大，且只在命中时跑
        while (maxExtend < maxPossible && cand[i + maxExtend] === h[pos + maxExtend]) {
          maxExtend += 1;
          // 适度上限，避免极端情况 while 太久；1200 字前缀够用了
          if (maxExtend >= 260) break;
        }
        bestMatchLen = Math.max(bestMatchLen, maxExtend);
        bestHistoryIndex = hi;
        return { checked: usable.length, hit: true, bestMatchLen, bestHistoryIndex, windowsChecked };
      }
    }
  }

  return { checked: usable.length, hit: false, bestMatchLen, bestHistoryIndex, windowsChecked };
};

export const shouldAbortEarlyForSubstringEcho = (sub, opts = {}) => {
  const {
    minMatchLen = 80,
  } = opts;
  // 只要做过检查（checked>0）即可参与判定；history 为空时 checked 可能为 0
  if (!sub || sub.checked <= 0) return false;
  return !!sub.hit && (sub.bestMatchLen >= minMatchLen);
};

export const buildAntiRepeatInstruction = () => {
  return [
    '写作要求（非常重要）：',
    '1) 严禁复述、照抄或仿写前文已出现的句子/段落（包含同义改写式复读）。',
    '2) 如果必须回顾信息，请用一句极短总结带过，然后立刻推进新内容。',
    '3) 必须使用中文全角标点，避免无标点长串。',
  ].join('\n');
};
