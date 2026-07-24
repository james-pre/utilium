// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2026 James Prevett

import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { Resource } from '../src/cache.js';

/**
 * Regression tests for zen-fs/core#297 / utilium#5:
 * whole-file read corruption after partial reads at a nonzero base offset.
 *
 * A `Region`'s `data` starts at `region.offset`, so positions within it are
 * relative to `region.offset` — not absolute resource offsets. `add` and
 * `collect` used to mix the two, so any region whose `offset > 0` ended up with
 * bytes stored at the wrong place (and an over-extended buffer). Reads then came
 * back with the right length but the wrong bytes.
 */

/** Deterministic, distinctive file content so misplaced bytes don't coincide. */
function makeContent(size: number): Uint8Array {
	const content = new Uint8Array(size);
	for (let i = 0; i < size; i++) content[i] = (i * 31 + 7) & 0xff;
	return content;
}

/**
 * Reconstruct an absolute byte range from the cache the way a correct consumer
 * would: each region's `data` begins at `region.offset`, so a byte at absolute
 * offset `o` lives at `region.data[o - region.offset]`.
 */
function readRange<ID>(resource: Resource<ID>, start: number, end: number): Uint8Array {
	const out = new Uint8Array(end - start);
	for (const region of resource.regions) {
		const regionEnd = region.offset + region.data.byteLength;
		const from = Math.max(start, region.offset);
		const to = Math.min(end, regionEnd);
		if (from >= to) continue;
		out.set(region.data.subarray(from - region.offset, to - region.offset), from - start);
	}
	return out;
}

suite('Resource cache', () => {
	test('overlapping adds within a region at a nonzero offset preserve bytes #5', () => {
		const content = makeContent(200);
		const resource = new Resource<string>('overlap', content.byteLength, {});

		// Two partial reads at nonzero offsets; the second overlaps the first,
		// so it lands inside the existing region (the buggy `add` path).
		resource.add(content.slice(10, 110), 10);
		resource.add(content.slice(60, 160), 60);

		assert.deepEqual(readRange(resource, 10, 160), content.slice(10, 160));
	});

	test('sequential partial reads then a whole read #5', () => {
		const content = makeContent(300);
		const resource = new Resource<string>('sequential', content.byteLength, {});

		// Three adjacent partial reads, all at a nonzero base offset. Each pair is
		// within the region-gap threshold, so `collect` merges them — the path
		// that used to over-extend the buffer and shift later regions.
		resource.add(content.slice(50, 100), 50);
		resource.add(content.slice(100, 150), 100);
		resource.add(content.slice(150, 200), 150);

		// The whole cached span must read back the original bytes.
		assert.deepEqual(readRange(resource, 50, 200), content.slice(50, 200));

		// `cached()` reports the full span, so a consumer really would do the
		// whole read above expecting correct data.
		assert.deepEqual(resource.cached(50, 200), [{ start: 50, end: 200 }]);
	});

	test('a region at a nonzero offset does not over-extend its buffer #5', () => {
		const content = makeContent(500);
		const resource = new Resource<string>('extent', content.byteLength, {});

		resource.add(content.slice(100, 150), 100);
		resource.add(content.slice(150, 200), 150);

		// After merging, the single region covers exactly [100, 200): 100 bytes
		// starting at offset 100. The bug extended it to `next.offset + length`
		// (200) bytes, claiming a phantom [200, 300).
		assert.equal(resource.regions.length, 1);
		const [region] = resource.regions;
		assert.equal(region.offset, 100);
		assert.equal(region.data.byteLength, 100);
		assert.deepEqual(region.data, content.slice(100, 200));
	});

	test('scattered partial reads at nonzero offsets read back correctly #5', () => {
		const content = makeContent(400);
		const resource = new Resource<string>('scattered', content.byteLength, {});

		// Out-of-order, non-contiguous partial reads, none starting at 0.
		resource.add(content.slice(200, 250), 200);
		resource.add(content.slice(80, 130), 80);
		resource.add(content.slice(130, 180), 130);
		resource.add(content.slice(250, 300), 250);

		assert.deepEqual(readRange(resource, 80, 180), content.slice(80, 180));
		assert.deepEqual(readRange(resource, 200, 300), content.slice(200, 300));
	});
});
