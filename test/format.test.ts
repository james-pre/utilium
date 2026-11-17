// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2026 James Prevett

import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { dateRange, relativeToDate, timeSpan } from 'utilium/format';

const now = Date.UTC(2026, 0, 15, 12);

suite('relativeToDate', () => {
	test('past dates', () => {
		assert.equal(relativeToDate(now - 30_000, now), '1 minute ago');
		assert.equal(relativeToDate(now - 5 * 60_000, now), '5 minutes ago');
		assert.equal(relativeToDate(now - 3600_000, now), '1 hour ago');
		assert.equal(relativeToDate(now - 3 * 24 * 3600_000, now), '3 days ago');
	});

	test('future dates', () => {
		assert.equal(relativeToDate(now + 2 * 3600_000, now), 'in 2 hours');
		assert.equal(relativeToDate(now + 24 * 3600_000, now), 'in 1 day');
	});

	test('accepts dates and numbers', () => {
		assert.equal(relativeToDate(new Date(now - 2 * 60_000), new Date(now)), '2 minutes ago');
		assert.equal(relativeToDate(new Date(now - 2 * 60_000), now), '2 minutes ago');
	});

	test('defaults to now', () => {
		assert.equal(relativeToDate(Date.now() - 10 * 60_000), '10 minutes ago');
	});
});

suite('timeSpan', () => {
	test('uses the largest units', () => {
		assert.equal(timeSpan(30_000), '30 seconds');
		assert.equal(timeSpan(10 * 60_000), '10 minutes');
		assert.equal(timeSpan(3600_000 + 5 * 60_000), '1 hour 5 minutes');
		assert.equal(timeSpan(2 * 24 * 3600_000 + 3 * 3600_000), '2 days 3 hours');
	});

	test('rounds to the smallest unit used', () => {
		assert.equal(timeSpan(9 * 60_000 + 29_600), '9 minutes 30 seconds');
		assert.equal(timeSpan(3600_000 + 5 * 60_000 + 40_000), '1 hour 6 minutes');
		assert.equal(timeSpan(23 * 3600_000 + 59 * 60_000 + 40_000), '24 hours');
	});

	test('precision', () => {
		assert.equal(timeSpan(3600_000 + 5 * 60_000 + 7_000, 3), '1 hour 5 minutes 7 seconds');
		assert.equal(timeSpan(3600_000 + 40 * 60_000, 1), '2 hours');
	});

	test('short and negative lengths', () => {
		assert.equal(timeSpan(0), '0 seconds');
		assert.equal(timeSpan(400), '0 seconds');
		assert.equal(timeSpan(-90_000), '1 minute 30 seconds');
	});
});

suite('dateRange', () => {
	test('includes the relative time', () => {
		const date = new Date(Date.now() - 2 * 3600_000);
		assert.equal(dateRange(date), `${date.toLocaleString()} (2 hours ago)`);
	});
});
