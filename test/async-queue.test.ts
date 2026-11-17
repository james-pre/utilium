// SPDX-License-Identifier: LGPL-3.0-or-later

import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { AsyncQueue } from 'utilium/async-queue';

suite('AsyncQueue', () => {
	test('functions run in order, one at a time', async () => {
		const queue = new AsyncQueue();
		const events: string[] = [];

		for (const [name, delay] of [
			['a', 10],
			['b', 0],
			['c', 5],
		] as const) {
			queue.defer(async () => {
				events.push(name + ' start');
				await setTimeout(delay);
				events.push(name + ' end');
			});
		}

		assert.equal(queue.size, 3);
		await queue.settled();
		assert.equal(queue.size, 0);
		assert.deepEqual(events, ['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
	});

	test('a failure does not stop later operations and is thrown once', async () => {
		const queue = new AsyncQueue();
		const ran: number[] = [];

		queue.defer(() => Promise.reject(new Error('first')));
		queue.defer(() => Promise.reject(new Error('second')));
		queue.defer(async () => void ran.push(3));

		await queue.settled();
		assert.deepEqual(ran, [3]);
		assert.throws(() => queue.throwIfError(), { message: 'first' });
		assert.doesNotThrow(() => queue.throwIfError());
	});

	test('failures dispatch error events', async () => {
		const queue = new AsyncQueue();
		const errors: unknown[] = [];
		queue.addEventListener('error', event => errors.push((event as ErrorEvent).error));

		queue.defer(() => Promise.reject('not an error'));
		queue.defer(() => {
			throw new Error('thrown synchronously');
		});
		await queue.settled();

		assert.equal(errors.length, 2);
		assert.equal(errors[0], 'not an error');
		assert.throws(() => queue.throwIfError(), { message: 'not an error' });
	});

	test('a promise that rejects before earlier operations settle is not unhandled', async () => {
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		process.on('unhandledRejection', onUnhandled);

		const queue = new AsyncQueue();
		queue.defer(() => setTimeout(20));
		queue.add(Promise.reject(new Error('early')));

		await setTimeout(10);
		await queue.settled();
		process.off('unhandledRejection', onUnhandled);

		assert.deepEqual(unhandled, []);
		assert.throws(() => queue.throwIfError(), { message: 'early' });
	});

	test('settled waits for added promises and the operations before them', async () => {
		const queue = new AsyncQueue();
		const events: string[] = [];

		queue.defer(async () => {
			await setTimeout(10);
			events.push('function');
		});
		queue.add(setTimeout(0).then(() => events.push('promise')));

		assert.equal(queue.size, 2);
		await queue.settled();
		assert.deepEqual(events, ['promise', 'function']);
		assert.equal(queue.size, 0);
	});
});
