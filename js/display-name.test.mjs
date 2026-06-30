import assert from 'node:assert/strict';
import { displayNameFor, displayNameWithEmail } from './utils.js';

assert.equal(displayNameFor({ display_name: '小明', email: 'a@example.com' }), '小明');
assert.equal(displayNameFor({ display_name: '  ', email: 'a@example.com' }), 'a@example.com');
assert.equal(displayNameFor({ email: 'a@example.com' }), 'a@example.com');
assert.equal(displayNameFor(null, 'fallback@example.com'), 'fallback@example.com');
assert.equal(displayNameFor(null), '匿名');

assert.equal(displayNameWithEmail({ display_name: '小明', email: 'a@example.com' }), '小明 · a@example.com');
assert.equal(displayNameWithEmail({ display_name: 'a@example.com', email: 'a@example.com' }), 'a@example.com');
assert.equal(displayNameWithEmail({ email: 'a@example.com' }), 'a@example.com');
