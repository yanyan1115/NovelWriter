// 标点密度自检与修复提示生成（纯本地逻辑，不消耗 token）

// 中文/英文常见标点集合
export const CN_PUNCT = new Set(Array.from('，。！？；：、“”‘’（）《》——……、'));
export const EN_PUNCT = new Set([',', '.', '?', '!', ';', ':', '"', "'", '(', ')', '[', ']', '{', '}', '-', '—']);

export const isPunctChar = (ch) => CN_PUNCT.has(ch) || EN_PUNCT.has(ch);

export const analyzePunctuation = (text) => {
  const s = (text || '').trim();
  if (!s) {
    return {
      charCount: 0,
      cnPunct: 0,
      enPunct: 0,
      punctCount: 0,
      punctRatio: 0,
      maxRunWithoutPunct: 0,
      hasMixedPunct: false,
    };
  }

  let cn = 0;
  let en = 0;
  let maxRun = 0;
  let run = 0;

  for (const ch of s) {
    if (CN_PUNCT.has(ch)) cn += 1;
    if (EN_PUNCT.has(ch)) en += 1;

    if (isPunctChar(ch) || ch === '\n') {
      if (run > maxRun) maxRun = run;
      run = 0;
    } else {
      run += 1;
    }
  }
  if (run > maxRun) maxRun = run;

  const punctCount = cn + en;
  const charCount = s.length;
  const punctRatio = charCount > 0 ? punctCount / charCount : 0;
  const hasMixedPunct = cn > 0 && en > 0;

  return {
    charCount,
    cnPunct: cn,
    enPunct: en,
    punctCount,
    punctRatio,
    maxRunWithoutPunct: maxRun,
    hasMixedPunct,
  };
};

// 判断是否需要自动修复（阈值可调整）
export const shouldAutoFixPunctuation = (analysis, opts = {}) => {
  const {
    minPunctRatio = 0.006, // 0.6%
    maxRunThreshold = 140, // 连续 140 字无标点
    allowMixed = false,
  } = opts;

  if (!analysis || analysis.charCount === 0) return false;

  if (!allowMixed && analysis.hasMixedPunct) return true;
  if (analysis.punctRatio < minPunctRatio) return true;
  if (analysis.maxRunWithoutPunct >= maxRunThreshold) return true;

  return false;
};

// 生成“只修标点”的修复指令（用于二次请求）
export const buildPunctuationFixPrompt = (text) => {
  return [
    '请只对下列文本进行“标点与中英符号统一”的修订：',
    '1) 必须保持原文每个字词的顺序与用词不变（不得增删词句，不得润色改写）。',
    '2) 只允许：添加/删除/替换标点符号；将英文半角标点替换为中文全角标点。',
    '3) 输出修订后的全文，不要输出解释。',
    '',
    '【待修订文本】',
    text || '',
  ].join('\n');
};





