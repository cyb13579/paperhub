import assert from 'node:assert/strict';
import { getFileValidationError, isAllowedUploadExt } from './utils.js';

assert.equal(isAllowedUploadExt('pdf'), true);
assert.equal(isAllowedUploadExt('MP4'), true);
assert.equal(isAllowedUploadExt('exe'), false);

assert.equal(getFileValidationError(null), '请选择文件');
assert.equal(getFileValidationError({ name: 'empty.pdf', size: 0 }), '文件为空');
assert.equal(getFileValidationError({ name: 'huge.pdf', size: 104857601 }), '文件不能超过100MB');
assert.equal(getFileValidationError({ name: 'bad.exe', size: 10 }), '不支持的文件格式: .exe');
assert.equal(getFileValidationError({ name: 'ok.mp4', size: 10 }), '');
