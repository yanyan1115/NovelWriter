// This file will handle communication with the Large Language Model.

/**
 * Sends a list of messages to the LLM and gets a streaming completion.
 * @param {Array<Object>} messages - The conversation history.
 * @param {Object} settings - The session-specific settings.
 * @param {function(string): void} onChunk - Callback for each piece of text received.
 * @param {function(): void} onFinish - Callback for when the stream is finished.
 */
export const getCompletion = ({ messages, settings, onChunk, onFinish, onMetadata, onError }) => {
  const toNumberOr = (v, fallback) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  // 允许 0.05 步进：UI 允许更细的调参时，这里也要保留小数精度
  const round2 = (n) => Math.round(n * 100) / 100;

  const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let firstChunkTime = null;
  let startTime = performance.now();

  const {
    apiKey,
    apiBaseUrl,
    model,
    temperature,
    systemPrompt,
    presence_penalty,
    frequency_penalty,
    max_tokens,
    usePunctuationBias,
    punctuationBiasTokenIds,
    debugLLM,
    debugLogitBiasProbe,
  } = settings;

  if (!apiKey || !apiBaseUrl || !model) {
    const errorMessage = '错误：API Key、API Base URL 或模型名称未在当前会话中配置。';
    if (onChunk) onChunk(errorMessage);
    if (onFinish) onFinish();
    return () => {}; // Return an empty abort function
  }

  // Prepare messages, including the system prompt if it exists
  // 双保险：过滤 UI 墓碑行/软删除消息（即使上游漏过滤，也不进入模型上下文）
  const filtered = (messages || []).filter(m => m && !m.deletedAt && m.type !== 'tombstone');
  const requestMessages = filtered.map(m => ({ role: m.author, content: m.text }));
  if (systemPrompt) {
    requestMessages.unshift({ role: 'system', content: systemPrompt });
  }

  // 数值兜底 + 范围裁剪：避免 undefined 被 JSON.stringify 丢字段，导致“调参无效”
  const safeTemperature = clamp(toNumberOr(temperature, 1), 0, 2);
  const safePresence = round2(clamp(toNumberOr(presence_penalty, 0), -2, 2));
  const safeFrequency = round2(clamp(toNumberOr(frequency_penalty, 0), -2, 2));
  const safeMaxTokens = Math.trunc(clamp(toNumberOr(max_tokens, 1000), 1, 100000));

  const requestPayload = {
    model: model,
    messages: requestMessages,
    stream: true,
    temperature: safeTemperature,
    top_p: 1,
    // 注意：JSON.stringify 会自动丢弃值为 undefined 的字段。
    // 所以这里必须保证传入的都是“确定的数值”。
    presence_penalty: safePresence,
    frequency_penalty: safeFrequency,
    max_tokens: safeMaxTokens,
  };

  // 可选：标点保护（logit_bias）
  // 说明：不同服务端/模型对 logit_bias 支持不一；若不支持会在下面自动回退。
  if (usePunctuationBias && Array.isArray(punctuationBiasTokenIds) && punctuationBiasTokenIds.length > 0) {
    const bias = {};
    for (const id of punctuationBiasTokenIds) {
      // 适度正向 bias：让模型更愿意输出这些 token，从而抵消 penalty/漂移
      bias[String(id)] = 12;
    }
    requestPayload.logit_bias = bias;
  }

  const shouldDebugLLM = !!debugLLM;

  const nowIso = () => new Date().toISOString();

  const computePunctStats = (text) => {
    const s = text || '';
    const count = (re) => (s.match(re) || []).length;

    // 中文全角
    const cnComma = count(/，/g);
    const cnPeriod = count(/。/g);
    const cnColon = count(/：/g);
    const cnSemi = count(/；/g);
    const cnQ = count(/？/g);
    const cnE = count(/！/g);
    const cnQuotes = count(/[“”]/g);

    // 英文半角
    const enComma = count(/,/g);
    const enPeriod = count(/\./g);
    const enColon = count(/:/g);
    const enSemi = count(/;/g);
    const enQ = count(/\?/g);
    const enE = count(/!/g);

    const allPunct = cnComma + cnPeriod + cnColon + cnSemi + cnQ + cnE + cnQuotes + enComma + enPeriod + enColon + enSemi + enQ + enE;
    const punctRatio = s.length > 0 ? allPunct / s.length : 0;

    // 最长无“常见标点”的连续长度
    const chunks = s.split(/[，。！？：；,\.\?!:;“”\n]/);
    const maxNoPunctRun = chunks.reduce((m, c) => Math.max(m, c.length), 0);

    return {
      len: s.length,
      punctRatio: Number(punctRatio.toFixed(4)),
      maxNoPunctRun,
      cn: { comma: cnComma, period: cnPeriod, colon: cnColon, semi: cnSemi, q: cnQ, e: cnE, quotes: cnQuotes },
      en: { comma: enComma, period: enPeriod, colon: enColon, semi: enSemi, q: enQ, e: enE },
    };
  };

  const computePunctStatsSegmented = (text) => {
    const s = text || '';
    const n = s.length;
    if (n === 0) {
      return {
        total: computePunctStats(''),
        segments: {
          first: computePunctStats(''),
          middle: computePunctStats(''),
          last: computePunctStats(''),
        },
      };
    }

    const a = Math.floor(n / 3);
    const b = Math.floor((n * 2) / 3);

    const first = s.slice(0, a);
    const middle = s.slice(a, b);
    const last = s.slice(b);

    return {
      total: computePunctStats(s),
      segments: {
        first: computePunctStats(first),
        middle: computePunctStats(middle),
        last: computePunctStats(last),
      },
    };
  };

  const sendOnce = (payload, { isRetry = false } = {}) => {
    if (shouldDebugLLM) {
      try {
        const summary = {
          requestId,
          model: payload.model,
          temperature: payload.temperature,
          top_p: payload.top_p,
          presence_penalty: payload.presence_penalty,
          frequency_penalty: payload.frequency_penalty,
          max_tokens: payload.max_tokens,
          has_logit_bias: !!payload.logit_bias,
          logit_bias_size: payload.logit_bias ? Object.keys(payload.logit_bias).length : 0,
          messages_count: Array.isArray(payload.messages) ? payload.messages.length : 0,
          system_prompt_len: (systemPrompt || '').length,
        };
        // 防重复：同一个 requestId 的 debug 只打印一次
        if (!getCompletion._printedLLMDebugIds) getCompletion._printedLLMDebugIds = new Set();
        if (!getCompletion._printedLLMDebugIds.has(requestId)) {
          getCompletion._printedLLMDebugIds.add(requestId);
          console.log('[LLM Debug]', JSON.stringify(summary));
        }
      } catch (e) {
        console.log('[LLM Debug] (failed to print)');
      }
    }

    const body = JSON.stringify(payload);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiBaseUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let lastResponseLength = 0;
    let finalUsage = null;
    let streamFinished = false; // Flag to prevent multiple onFinish calls

    const finishStream = () => {
      if (!streamFinished) {
        streamFinished = true;
        if (onFinish) onFinish();
      }
    };

    xhr.onprogress = () => {
      if (streamFinished) return;

      const responseText = xhr.responseText;
      const newText = responseText.substring(lastResponseLength);
      lastResponseLength = responseText.length;

      const lines = newText.split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
            const totalTime = performance.now() - startTime;
            if (onMetadata) {
              onMetadata({
                firstTokenTime: firstChunkTime ? firstChunkTime - startTime : null,
                totalTime: totalTime,
                usage: finalUsage,
                model: model,
              });
            }
            finishStream();
            return;
          }
          try {
            // SSE 分片可能会出现“半截 JSON”（尤其是 data 行被拆包时）。
            // 这种情况不应刷红屏，只需跳过等待后续分片。
            const json = JSON.parse(data);
            if (json.usage) {
              finalUsage = json.usage;
            }

            const content = json.choices[0]?.delta?.content;
            if (content) {
              if (firstChunkTime === null) {
                firstChunkTime = performance.now();
              }
              if (onChunk) {
                onChunk(content);
              }
            }
          } catch (e) {
            // 只降噪：把“半截 JSON”从 console.error 降级为静默跳过，避免 LogBox 红屏。
            // 真正的网络/HTTP 错误仍会在 onerror/onload 里报出来。
            const msg = String(e && e.message ? e.message : e);
            if (msg.toLowerCase().includes('unexpected end of input')) {
              // ignore
            } else {
              console.warn('Error parsing SSE data:', e);
            }
          }
        }
      }
    };

    const maybeRetryWithoutLogitBias = () => {
      const msg = (xhr.responseText || '').toLowerCase();
      const unsupported = msg.includes('logit_bias') || msg.includes('unknown field') || msg.includes('unrecognized');
      if (!isRetry && payload.logit_bias && unsupported) {
        // 回退：去掉 logit_bias 再试一次
        const next = { ...payload };
        delete next.logit_bias;
        if (onChunk) onChunk('\n[提示] 当前接口不支持 logit_bias，已自动回退关闭“标点保护”。\n');
        if (onError) onError({ type: 'logit_bias_unsupported', status: xhr.status, responseText: xhr.responseText });
        return sendOnce(next, { isRetry: true });
      }
      return null;
    };

    xhr.onerror = () => {
      console.error('XHR Error:', xhr.status, xhr.responseText);
      if (onChunk) onChunk(`\n[网络错误: ${xhr.status}]`);
      if (onError) onError({ type: 'network', status: xhr.status, responseText: xhr.responseText });
      finishStream();
    };

    xhr.onload = () => {
      if (xhr.status !== 200) {
        console.error('Request failed:', xhr.status, xhr.responseText);
        const retried = maybeRetryWithoutLogitBias();
        if (retried) return;

        if (onChunk) onChunk(`\n[请求失败: ${xhr.status} - ${xhr.responseText}]`);
        if (onError) onError({ type: 'http', status: xhr.status, responseText: xhr.responseText });
      }
      // The stream might finish without a [DONE] message in some cases (e.g. non-streaming error response)
      finishStream();
    };

    xhr.send(body);

    return () => {
      xhr.abort();
      finishStream();
    };
  };

  const runLogitBiasProbeIfNeeded = () => {
    if (!debugLogitBiasProbe) return false;

    // 防重复：同一个 getCompletion(requestId) 最多触发一次 probe
    if (!getCompletion._probeTriggeredIds) getCompletion._probeTriggeredIds = new Set();
    if (getCompletion._probeTriggeredIds.has(requestId)) return false;
    getCompletion._probeTriggeredIds.add(requestId);

    // 防止递归：probe 内部是额外请求，不应再次触发 probe
    if (settings.debugLogitBiasProbeOnceConsumed) return false;

    // 只做短输出、固定 prompt 的对照实验；绝不打印任何生成文本
    const probePrompt = [
      '【logit_bias 对照测试】',
      '请输出约 3800～4200 字的中文正文（不要分点、不要列清单），内容可以随意，但要保持自然叙述。',
      '硬性要求：平均每 20 个汉字至少出现 1 个中文全角标点（例如“，”“。”“？”“！”“：”“；”）。',
      '必须覆盖较长篇幅，不得提前收尾；不得出现长段无标点的连续文本。',
      '禁止输出任何英文半角标点（, . ! ? : ;）。',
      '不要解释，不要输出标题或额外说明，只输出正文。'
    ].join('\n');

    // 立即提示：probe 已开始（只打很短的日志，避免你“以为没触发”）
    if (!getCompletion._printedProbeStartIds) getCompletion._printedProbeStartIds = new Set();
    if (!getCompletion._printedProbeStartIds.has(requestId)) {
      getCompletion._printedProbeStartIds.add(requestId);
      console.log('[logit_bias probe] start', JSON.stringify({ requestId, t: nowIso() }));
    }

    const basePayload = {
      ...requestPayload,
      // probe 不要带入长上下文，只用一个 user prompt，避免刷屏/变量太多
      messages: [{ role: 'user', content: probePrompt }],
      // 固定生成长度，保证可比（约 4000 字需要更高上限）
      max_tokens: Math.min(6000, safeMaxTokens),
      temperature: safeTemperature,
      top_p: 1,
      stream: true,
    };

    // 构造 A/B 两个 payload：只差一个字段 usePunctuationBias（是否携带 logit_bias）
    const withBias = { ...basePayload };
    const withoutBias = { ...basePayload };
    delete withoutBias.logit_bias;

    // withBias：沿用当前设置逻辑，如果当前设置其实没生成 logit_bias（比如 tokenIds 为空），那也能测出来
    // 但为了保证“有 bias”的组一定带 bias：如果当前不带，我们就用 punctuationBiasTokenIds 强行生成一次。
    if (!withBias.logit_bias && Array.isArray(punctuationBiasTokenIds) && punctuationBiasTokenIds.length > 0) {
      const bias = {};
      for (const id of punctuationBiasTokenIds) bias[String(id)] = 12;
      withBias.logit_bias = bias;
    }

    const collectText = (payload) => new Promise((resolve) => {
      let text = '';
      const localOnChunk = (c) => { text += c; };
      const localOnFinish = () => resolve(text);
      // 复用 sendOnce，但禁止把 chunk 透传到 UI（因此不传 onChunk/onFinish 给外层）
      // 这里通过临时包装来吃掉输出
      const savedOnChunk = onChunk;
      const savedOnFinish = onFinish;
      const savedOnMetadata = onMetadata;
      const savedOnError = onError;

      // 临时劫持回调：sendOnce 内部调用的是闭包里的 onChunk/onFinish 等
      // 由于当前实现直接使用闭包变量，我们采用“直接调用 sendOnce，但把外部 onChunk/onFinish 置空”的策略。
      // 最简单做法：手动解析 xhr 流并收集文本，但那会复制大量逻辑。
      // 这里折中：直接调用 sendOnce，但在调用前用局部变量覆盖（通过 shadow 变量不可行）。
      // 因此我们改用一个最小的内部实现：复制 sendOnce 的网络部分会更稳，但为了保持改动小，
      // 我们在本 probe 分支中重新实现一次轻量版请求（仅收集 content）。

      // --- 轻量 probe 请求 ---
      const xhr = new XMLHttpRequest();
      xhr.open('POST', apiBaseUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      let lastLen = 0;
      xhr.onprogress = () => {
        const responseText = xhr.responseText;
        const newText = responseText.substring(lastLen);
        lastLen = responseText.length;

        const lines = newText.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.substring(6);
          if (data === '[DONE]') {
            localOnFinish();
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) localOnChunk(content);
          } catch (e) {
            // ignore parse errors for probe
          }
        }
      };
      xhr.onerror = () => localOnFinish();
      xhr.onload = () => localOnFinish();
      xhr.send(JSON.stringify(payload));
    });

    (async () => {
      try {
        const t0 = Date.now();
        const aText = await collectText(withBias);
        const tA = Date.now();
        const bText = await collectText(withoutBias);
        const tB = Date.now();

        const a = computePunctStatsSegmented(aText);
        const b = computePunctStatsSegmented(bText);

        // 防重复：同一个 requestId 的 probe 结果只打印一次
        if (!getCompletion._printedProbeIds) getCompletion._printedProbeIds = new Set();
        if (!getCompletion._printedProbeIds.has(requestId)) {
          getCompletion._printedProbeIds.add(requestId);
          console.log('[logit_bias probe]', JSON.stringify({
          requestId,
          with_logit_bias: { has: !!withBias.logit_bias, size: withBias.logit_bias ? Object.keys(withBias.logit_bias).length : 0, stats: a },
          without_logit_bias: { has: false, size: 0, stats: b },
        }));
        }
        // 一次性测试：通知上层关闭开关（避免每次请求都额外消耗 2 次调用）
        if (typeof onError === 'function') {
          onError({ type: 'debug_probe_done', probe: 'logit_bias', requestId });
        }
      } catch (e) {
        console.log('[logit_bias probe] failed');
        // 失败也尝试通知上层关闭，避免持续消耗
        if (typeof onError === 'function') {
          onError({ type: 'debug_probe_done', probe: 'logit_bias', requestId, failed: true });
        }
      }
    })();

    return true;
  };

  // 若触发对照测试：先运行 probe；同时继续正常请求（不影响使用）
  // 说明：probe 是额外的两次短请求，不会把生成内容写入 UI。
  // 一次性测试：probe 跑完后，会通过 onError 回调发出一个内部事件，要求上层把 debugLogitBiasProbe 关掉。
  // 注意：为了避免 React dev 下潜在的重复调用，这里用 set 去重。
  // 只在显式开启 debugLogitBiasProbe 时才会跑；默认关闭，避免额外请求/潜在干扰
  runLogitBiasProbeIfNeeded();

  return sendOnce(requestPayload);
};
