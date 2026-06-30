import assert from 'node:assert/strict';
import { shouldWaitForEmailConfirmation } from './utils.js';

assert.equal(shouldWaitForEmailConfirmation(null), true);
assert.equal(shouldWaitForEmailConfirmation(undefined), true);
assert.equal(shouldWaitForEmailConfirmation({ id: 'user-1' }), false);
