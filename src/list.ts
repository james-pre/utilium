import { EventEmitter } from 'eventemitter3';

export class List<T> extends EventEmitter<'update'> implements Set<T> {
	public readonly [Symbol.toStringTag] = 'List';

	protected data = new Set<T>();

	public array(): T[] {
		return [...this.data];
	}

	public json() {
		return JSON.stringify(this.array());
	}

	public toString() {
		return this.array().join('\n');
	}

	// Set methods

	public add(value: T): this {
		this.data.add(value);
		this.emit('update');
		return this;
	}

	public clear(): void {
		this.data.clear();
		this.emit('update');
	}

	public delete(value: T): boolean {
		const success = this.data.delete(value);
		this.emit('update');
		return success;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
		this.data.forEach(callbackfn, thisArg);
	}

	public has(value: T): boolean {
		return this.data.has(value);
	}

	public get size(): number {
		return this.data.size;
	}

	public entries(): IterableIterator<[T, T]> {
		return this.data.entries();
	}

	public keys(): IterableIterator<T> {
		return this.data.keys();
	}

	public values(): IterableIterator<T> {
		return this.data.values();
	}

	public [Symbol.iterator](): IterableIterator<T> {
		return this.data[Symbol.iterator]();
	}
}
