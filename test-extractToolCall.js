import assert from 'assert';
import { extractToolCall } from './lib/extractToolCall.js';

// Test 1: OpenAI function_call with JSON string args (legacy)
const completion1 = { choices: [ { message: { function_call: { name: 'doThing', arguments: '{"x":1}' } } } ] };
const res1 = extractToolCall(completion1);
assert(res1, 'should extract tool call');
assert.strictEqual(res1.name, 'doThing');
assert.deepStrictEqual(res1.args, { x: 1 });
assert.strictEqual(res1.source, 'function_call');

// Test 2: tool_call with object args (generic provider)
const completion2 = { choices: [ { message: { tool_call: { name: 'search', arguments: { q: 'hello' } } } } ] };
const res2 = extractToolCall(completion2);
assert(res2, 'should extract tool call');
assert.strictEqual(res2.name, 'search');
assert.deepStrictEqual(res2.args, { q: 'hello' });
assert.strictEqual(res2.source, 'tool_call');

// Test 3: no tool call
const completion3 = { choices: [ { message: { content: 'just text' } } ] };
const res3 = extractToolCall(completion3);
assert.strictEqual(res3, null);

// Test 4: OpenAI tool_calls array (current standard)
const completion4 = {
  choices: [{
    message: {
      tool_calls: [{
        id: 'call_abc123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location": "San Francisco"}'
        }
      }]
    }
  }]
};
const res4 = extractToolCall(completion4);
assert(res4, 'should extract OpenAI tool call');
assert.strictEqual(res4.name, 'get_weather');
assert.deepStrictEqual(res4.args, { location: 'San Francisco' });
assert.strictEqual(res4.source, 'tool_calls[0]');

// Test 5: Anthropic format
const completion5 = {
  choices: [{
    message: {
      content: [
        { type: 'text', text: 'I need to check the weather.' },
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'get_weather',
          input: { location: 'San Francisco' }
        }
      ]
    }
  }]
};
const res5 = extractToolCall(completion5);
assert(res5, 'should extract Anthropic tool call');
assert.strictEqual(res5.name, 'get_weather');
assert.deepStrictEqual(res5.args, { location: 'San Francisco' });
assert.strictEqual(res5.source, 'anthropic.tool_use');

// Test 6: Gemini format
const completion6 = {
  candidates: [{
    content: {
      parts: [{
        function_call: {
          name: 'get_weather',
          args: { location: 'San Francisco' }
        }
      }]
    }
  }]
};
const res6 = extractToolCall(completion6);
assert(res6, 'should extract Gemini tool call');
assert.strictEqual(res6.name, 'get_weather');
assert.deepStrictEqual(res6.args, { location: 'San Francisco' });
assert.strictEqual(res6.source, 'gemini.function_call');

console.log('All extractToolCall tests passed');
