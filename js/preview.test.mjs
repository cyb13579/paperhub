import assert from 'node:assert/strict';
import { isPdfPreview, isVideoPreview, isEmbeddedPreview, getVideoMime } from './utils.js';

assert.equal(isPdfPreview('pdf'), true);
assert.equal(isPdfPreview('PDF'), true);
assert.equal(isPdfPreview('docx'), false);

assert.equal(isVideoPreview('mp4'), true);
assert.equal(isVideoPreview('webm'), true);
assert.equal(isVideoPreview('ogg'), true);
assert.equal(isVideoPreview('mov'), true);
assert.equal(isVideoPreview('m4v'), true);
assert.equal(isVideoPreview('pdf'), false);

assert.equal(isEmbeddedPreview('pdf'), true);
assert.equal(isEmbeddedPreview('mp4'), true);
assert.equal(isEmbeddedPreview('txt'), false);

assert.equal(getVideoMime('mp4'), 'video/mp4');
assert.equal(getVideoMime('webm'), 'video/webm');
assert.equal(getVideoMime('ogg'), 'video/ogg');
assert.equal(getVideoMime('mov'), 'video/mp4');
assert.equal(getVideoMime('m4v'), 'video/mp4');
assert.equal(getVideoMime('pdf'), '');
