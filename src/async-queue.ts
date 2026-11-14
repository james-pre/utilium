// SPDX-License-Identifier: LGPL-3.0-or-later

/**
 * Runs operations in the order they are added, without waiting for them.
 */
export class AsyncQueue extends EventTarget {
	#promise: Promise<unknown> = Promise.resolve();

	public settled(): Promise<unknown> {
		return this.#promise;
	}

	/** How many queued operations have not finished */
	#pending: number = 0;

	public get size(): number {
		return this.#pending;
	}

	#error?: Error;

	async #settle(operation: () => unknown): Promise<void> {
		try {
			await operation();
		} catch (e) {
			this.#error ??= Error.isError(e) ? e : new Error(String(e));
			this.dispatchEvent(new ErrorEvent('error', { error: e }));
		} finally {
			this.#pending--;
		}
	}

	/** Call `thunk` once every earlier operation has settled */
	public defer(thunk: () => Promise<unknown>): void {
		this.#pending++;
		this.#promise = this.#promise.finally(() => this.#settle(thunk));
	}

	/** Track an operation that has already started */
	public add(promise: Promise<unknown>): void {
		this.#pending++;
		this.#promise = Promise.all([this.#promise, this.#settle(() => promise)]);
	}

	public throwIfError(): void {
		if (!this.#error) return;
		const error = this.#error;
		this.#error = undefined;
		throw error;
	}
}
