import assert from 'node:assert/strict';
import { MIN_INDEXABLE_RELEASES, isIndexableReleaseCount } from './release-policy.mjs';

assert.equal(MIN_INDEXABLE_RELEASES, 8);
assert.equal(isIndexableReleaseCount(7), false);
assert.equal(isIndexableReleaseCount(8), true);
assert.equal(isIndexableReleaseCount(9), true);
assert.equal(isIndexableReleaseCount('8'), false);

console.log('test-release-policy: OK / 7件=noindex, 8件以上=index');
