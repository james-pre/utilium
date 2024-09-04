import { EventEmitter } from 'eventemitter3';

export class List<T> extends EventEmitter<'update'> implements Set<T>, RelativeIndexable<T> {
	public readonly [Symbol.toStringTag] = 'List';

	public constructor(values?: readonly T[] | Iterable<T> | null) {
		super();
		if (values) {
			this.push(...values);
		}
	}

	protected data = new Set<T>();

	public array(): T[] {
		return [...this.data];
	}

	public json() {
		return JSON.stringify([...this.data]);
	}

	public toString() {
		return this.join(',');
	}

	public set(index: number, value: T): void {
		if (Math.abs(index) > this.data.size) {
			throw new ReferenceError('Can not set an element outside the bounds of the list');
		}

		const data = [...this.data];
		data.splice(index, 1, value);
		this.data = new Set<T>(data);
		this.emit('update');
	}

	public deleteAt(index: number): void {
		if (Math.abs(index) > this.data.size) {
			throw new ReferenceError('Can not delete an element outside the bounds of the list');
		}

		this.delete([...this.data].at(index)!);
	}

	// Array methods

	public at(index: number): T {
		if (Math.abs(index) > this.data.size) {
			throw new ReferenceError('Can not access an element outside the bounds of the list');
		}

		return [...this.data].at(index)!;
	}

	public pop(): T | undefined {
		const item = [...this.data].pop();
		if (item !== undefined) {
			this.delete(item);
		}
		return item;
	}

	public push(...items: T[]): number {
		for (const item of items) {
			this.add(item);
		}
		return this.data.size;
	}

	public join(separator?: string): string {
		return [...this.data].join(separator);
	}

	public splice(start: number, deleteCount: number, ...items: T[]): T[] {
		if (Math.abs(start) > this.data.size) {
			throw new ReferenceError('Can not splice elements outside the bounds of the list');
		}

		const data = [...this.data];
		const deleted = data.splice(start, deleteCount, ...items);
		this.data = new Set<T>(data);
		this.emit('update');
		return deleted;
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

	public union<U>(other: ReadonlySetLike<U>): List<T | U> {
		return new List(this.data.union(other));
	}

	public intersection<U>(other: ReadonlySetLike<U>): List<T & U> {
		return new List(this.data.intersection(other));
	}

	public difference<U>(other: ReadonlySetLike<U>): List<T> {
		return new List(this.data.difference(other));
	}

	public symmetricDifference<U>(other: ReadonlySetLike<U>): List<T | U> {
		return new List(this.data.symmetricDifference(other));
	}

	public isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
		return this.data.isSubsetOf(other);
	}

	public isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
		return this.data.isSupersetOf(other);
	}

	public isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
		return this.data.isDisjointFrom(other);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public forEach(callbackfn: (value: T, value2: T, list: List<T>) => void, thisArg?: any): void {
		this.data.forEach((v1, v2) => callbackfn.call(thisArg, v1, v2, this));
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
