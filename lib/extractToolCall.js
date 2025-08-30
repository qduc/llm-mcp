// Normalizes various provider responses into a consistent tool-call shape
export function extractToolCall(completion) {
  const choice = completion?.choices?.[0];
  const message = choice?.message ?? {};

  function parseArgs(maybe) {
    if (maybe == null) return null;
    if (typeof maybe === 'object') return maybe;
    if (typeof maybe === 'string') {
      try {
        return JSON.parse(maybe);
      } catch (e) {
        return null; // keep raw in `raw`
      }
    }
    return null;
  }

  // OpenAI canonical function_call (deprecated but still supported)
  if (message.function_call) {
    const fc = message.function_call;
    const args = parseArgs(fc.arguments);
    return { source: 'function_call', name: fc.name ?? null, args, raw: fc };
  }

  // Some providers place a single tool_call on the message
  if (message.tool_call) {
    const tc = message.tool_call;
    const args = parseArgs(tc.arguments ?? tc.args ?? tc);
    return { source: 'tool_call', name: tc.name ?? null, args, raw: tc };
  }

  // tool_call inside metadata
  if (message.metadata?.tool_call) {
    const tc = message.metadata.tool_call;
    const args = parseArgs(tc.arguments ?? tc.args ?? tc);
    return { source: 'metadata.tool_call', name: tc.name ?? null, args, raw: tc };
  }

  // OpenAI tool_calls array (current standard)
  if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const tc = message.tool_calls[0];
    const args = parseArgs(tc.function?.arguments ?? tc.function?.args ?? tc.function ?? tc);
    const name = tc.function?.name ?? tc.name ?? null;
    return { source: 'tool_calls[0]', name, args, raw: tc };
  }

  // Anthropic format: content array with tool_use blocks
  if (message.content && Array.isArray(message.content)) {
    const toolUse = message.content.find(block => block.type === 'tool_use');
    if (toolUse) {
      const args = parseArgs(toolUse.input);
      return { source: 'anthropic.tool_use', name: toolUse.name ?? null, args, raw: toolUse };
    }
  }

  // Gemini format: candidates[0].content.parts with function_call
  const candidate = completion?.candidates?.[0];
  if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
    const functionCallPart = candidate.content.parts.find(part => part.function_call);
    if (functionCallPart?.function_call) {
      const fc = functionCallPart.function_call;
      const args = parseArgs(fc.args ?? fc.arguments);
      return { source: 'gemini.function_call', name: fc.name ?? null, args, raw: fc };
    }
  }

  return null;
}
