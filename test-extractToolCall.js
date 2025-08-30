import assert from 'assert';
import { extractToolCall } from './lib/extractToolCall.js';

// Test 1: OpenAI function_call with JSON string args
const completion1 = { choices: [ { message: { function_call: { name: 'doThing', arguments: '{"x":1}' } } } ] };
const res1 = extractToolCall(completion1);
assert(res1, 'should extract tool call');
assert.strictEqual(res1.name, 'doThing');
assert.deepStrictEqual(res1.args, { x: 1 });

// Test 2: tool_call with object args
const completion2 = { choices: [ { message: { tool_call: { name: 'search', arguments: { q: 'hello' } } } } ] };
const res2 = extractToolCall(completion2);
assert(res2, 'should extract tool call');
assert.strictEqual(res2.name, 'search');
assert.deepStrictEqual(res2.args, { q: 'hello' });

// Test 3: no tool call
const completion3 = { choices: [ { message: { content: 'just text' } } ] };
const res3 = extractToolCall(completion3);
assert.strictEqual(res3, null);

console.log('extractToolCall tests passed');
