// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2026 James Prevett

/**
 * Utility functions for working with iterators and streams
 */

/**
 * Converts an `AsyncIterator` or `Iterator` to a `ReadableStream`
 */
export function iteratorToStream<T>(iterator: AsyncIterator<T> | Iterator<T>): ReadableStream<T> {
	return new ReadableStream({
		async pull(controller) {
			try {
				const { value, done } = await iterator.next();
				if (done) {
					controller.close();
				} else {
					controller.enqueue(value);
				}
			} catch (err) {
				controller.error(err);
			}
		},
		async cancel() {
			await iterator.return?.();
		},
	});
}
