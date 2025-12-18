// This file will handle communication with the Large Language Model.

/**
 * Sends a list of messages to the LLM and gets a streaming completion.
 * @param {Array<Object>} messages - The conversation history.
 * @param {Object} settings - The session-specific settings.
 * @param {function(string): void} onChunk - Callback for each piece of text received.
 * @param {function(): void} onFinish - Callback for when the stream is finished.
 */
export const getCompletion = ({ messages, settings, onChunk, onFinish, onMetadata }) => {
  let firstChunkTime = null;
  let startTime = performance.now();
  const {
    apiKey,
    apiBaseUrl,
    model,
    temperature,
    systemPrompt,
  } = settings;

  if (!apiKey || !apiBaseUrl || !model) {
    const errorMessage = '错误：API Key、API Base URL 或模型名称未在当前会话中配置。';
    if (onChunk) onChunk(errorMessage);
    if (onFinish) onFinish();
    return () => {}; // Return an empty abort function
  }

  // Prepare messages, including the system prompt if it exists
  const requestMessages = messages.map(m => ({ role: m.author, content: m.text }));
  if (systemPrompt) {
    requestMessages.unshift({ role: 'system', content: systemPrompt });
  }

  const body = JSON.stringify({
    model: model,
    messages: requestMessages,
    stream: true,
    temperature: temperature,
  });

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
          console.error('Error parsing SSE data:', e);
        }
      }
    }
  };

  xhr.onerror = () => {
    console.error('XHR Error:', xhr.status, xhr.responseText);
    if (onChunk) onChunk(`\n[网络错误: ${xhr.status}]`);
    finishStream();
  };

  xhr.onload = () => {
    if (xhr.status !== 200) {
      console.error('Request failed:', xhr.status, xhr.responseText);
      if (onChunk) onChunk(`\n[请求失败: ${xhr.status} - ${xhr.responseText}]`);
    }
    // The stream might finish without a [DONE] message in some cases (e.g. non-streaming error response)
    // We call finishStream() here to handle those cases.
    finishStream();
  };

  xhr.send(body);

  return () => {
    xhr.abort();
    finishStream(); // Ensure cleanup and state update on manual abort
  };
};
