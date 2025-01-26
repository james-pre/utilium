/* Utilities for `fetch` when using range requests. It also allows you to handle errors easier */

import { extendBuffer } from './buffer.js';

/* eslint-disable @typescript-eslint/only-throw-error */

export interface CacheOptions {
	/**
	 * If true, use multiple buffers to cache a file.
	 * This is useful when working with small parts of large files,
	 * since we don't need to allocate a large buffer that is mostly unused
	 * @default true
	 */
	sparse?: boolean;

	/**
	 * The threshold for whether to combine regions or not
	 * @see CacheRegion
	 * @default 0xfff // 4 KiB
	 */
	regionGapThreshold?: number;

	/**
	 * Whether to only update the cache when changing or deleting resources
	 * @default false
	 */
	cacheOnly?: boolean;
}

export type CacheRange = { start: number; end: number };

export interface CacheRegion {
	/** The region's offset from the start of the resource */
	offset: number;

	/** Ranges cached in this region. These are absolute! */
	ranges: CacheRange[];

	/** Data for this region */
	data: Uint8Array;
}

/**
 * The cache for a specific resource
 * @internal
 */
export class ResourceCache {
	/** Regions used to reduce unneeded allocations. Think of sparse arrays. */
	public readonly regions: CacheRegion[] = [];

	public constructor(
		/** The resource URL */
		public readonly url: string,
		/** The full size of the resource */
		public readonly size: number,
		protected readonly options: CacheOptions
	) {
		options.sparse ??= true;
		if (!options.sparse) this.regions.push({ offset: 0, data: new Uint8Array(size), ranges: [] });

		resourcesCache.set(url, this);
	}

	/** Combines adjacent regions and combines adjacent ranges within a region */
	public collect(): void {
		if (!this.options.sparse) return;
		const { regionGapThreshold = 0xfff } = this.options;

		for (let i = 0; i < this.regions.length - 1; ) {
			const current = this.regions[i];
			const next = this.regions[i + 1];

			if (next.offset - (current.offset + current.data.byteLength) > regionGapThreshold) {
				i++;
				continue;
			}

			// Combine ranges
			current.ranges.push(...next.ranges);
			current.ranges.sort((a, b) => a.start - b.start);

			// Combine overlapping/adjacent ranges
			current.ranges = current.ranges.reduce((acc: CacheRange[], range) => {
				if (!acc.length || acc.at(-1)!.end < range.start) {
					acc.push(range);
				} else {
					acc.at(-1)!.end = Math.max(acc.at(-1)!.end, range.end);
				}
				return acc;
			}, []);

			// Extend buffer to include the new region
			current.data = extendBuffer(current.data, next.offset + next.data.byteLength);
			current.data.set(next.data, next.offset - current.offset);

			// Remove the next region after merging
			this.regions.splice(i + 1, 1);
		}
	}

	/** Takes an initial range and finds the sub-ranges that are not in the cache */
	public missing(start: number, end: number): CacheRange[] {
		const missingRanges: CacheRange[] = [];

		for (const region of this.regions) {
			if (region.offset >= end) break;

			for (const range of region.ranges) {
				if (range.end <= start) continue;

				if (range.start >= end) break;

				if (range.start > start) {
					missingRanges.push({ start, end: Math.min(range.start, end) });
				}

				// Adjust the current start if the region overlaps
				if (range.end > start) start = Math.max(start, range.end);

				if (start >= end) break;
			}

			if (start >= end) break;
		}

		// If there are still missing parts at the end
		if (start < end) missingRanges.push({ start, end });

		return missingRanges;
	}

	/** Get the region who's ranges include an offset */
	public regionAt(offset: number): CacheRegion | undefined {
		if (!this.regions.length) return;

		for (const region of this.regions) {
			if (region.offset > offset) break;

			// Check if the offset is within this region
			if (offset >= region.offset && offset < region.offset + region.data.byteLength) return region;
		}
	}

	/** Add new data to the cache at given specified offset */
	public add(data: Uint8Array, offset: number): this {
		const end = offset + data.byteLength;
		const region = this.regionAt(offset);

		if (region) {
			region.data = extendBuffer(region.data, end);
			region.data.set(data, offset);
			region.ranges.push({ start: offset, end });
			region.ranges.sort((a, b) => a.start - b.start);

			return this;
		}

		// Find the correct index to insert the new region
		const newRegion: CacheRegion = { data, offset: offset, ranges: [{ start: offset, end }] };
		const insertIndex = this.regions.findIndex(region => region.offset > offset);

		// Insert at the right index to keep regions sorted
		if (insertIndex == -1) {
			this.regions.push(newRegion); // Append if no later region exists
		} else {
			this.regions.splice(insertIndex, 0, newRegion); // Insert before the first region with a greater offset
		}

		return this;
	}
}

/**
 * @internal
 */
export const resourcesCache = new Map<string, ResourceCache | null>();

export type Issue = { tag: 'status'; response: Response } | { tag: 'buffer'; response: Response; message: string } | { tag: 'fetch' | 'size'; message: string } | Error;

interface Fetched<TBodyOptional extends boolean> {
	response: Response;
	data: false extends TBodyOptional ? Uint8Array : Uint8Array | undefined;
}

/**
 * Wraps `fetch`
 * @throws RequestError
 */
async function _fetch<const TBodyOptional extends boolean>(
	input: RequestInfo,
	init: RequestInit = {},
	bodyOptional: TBodyOptional = false as TBodyOptional
): Promise<Fetched<TBodyOptional>> {
	const response = await fetch(input, init).catch((error: Error) => {
		throw { tag: 'fetch', message: error.message } satisfies Issue;
	});

	if (!response.ok) throw { tag: 'status', response } satisfies Issue;

	const raw = await response.arrayBuffer().catch((error: Error) => {
		if (bodyOptional) return;
		throw { tag: 'buffer', response, message: error.message } satisfies Issue;
	});

	return { response, data: raw ? new Uint8Array(raw) : undefined } as Fetched<TBodyOptional>;
}

export interface Options extends CacheOptions {
	/** Optionally provide a function for logging warnings */
	warn?(message: string): unknown;
}

export interface GetOptions extends Options {
	/**
	 * When using range requests,
	 * a HEAD request must normally be used to determine the full size of the resource.
	 * This allows that request to be skipped
	 */
	size?: number;

	/** The start of the range */
	start?: number;

	/** The end of the range */
	end?: number;
}

/**
 * Make a GET request without worrying about ranges
 * @throws RequestError
 */
export async function get(url: string, options: GetOptions, init: RequestInit = {}): Promise<Uint8Array> {
	const req = new Request(url, init);

	// Request no using ranges
	if (typeof options.start != 'number' || typeof options.end != 'number') {
		const { data } = await _fetch(url, init);
		new ResourceCache(url, data.byteLength, options).add(data, 0);
		return data;
	}

	// Range requests

	if (typeof options.size != 'number') {
		options.warn?.(url + ': Size not provided, an additional HEAD request is being made');

		const { headers } = await fetch(req, { method: 'HEAD' });
		const size = parseInt(headers.get('Content-Length') ?? '');
		if (typeof size != 'number') throw { tag: 'size', message: 'Response is missing content-length header and no size was provided' } satisfies Issue;
		options.size = size;
	}

	const { size, start, end } = options;
	const cache = resourcesCache.get(url) ?? new ResourceCache(url, size, options);

	req.headers.set('If-Range', new Date().toUTCString());

	for (const { start: from, end: to } of cache.missing(start, end)) {
		const { data, response } = await _fetch(req, { headers: { Range: `bytes=${from}-${to}` } });

		if (response.status == 206) {
			cache.add(data, from);
			continue;
		}

		// The first response doesn't have a "partial content" (206) status
		options.warn?.(url + ': Remote does not support range requests with bytes. Falling back to full data.');
		new ResourceCache(url, size, options).add(data, 0);
		return data.subarray(start, end);
	}

	// This ensures we get a single buffer with the entire requested range
	cache.collect();

	const region = cache.regionAt(start)!;
	return region.data.subarray(start - region.offset, end - region.offset);
}

/**
 * Synchronously gets a cached resource
 * Assumes you pass valid start and end when using ranges
 */
export function getCached(url: string, options: GetOptions): { data?: Uint8Array; missing: CacheRange[] } {
	const cache = resourcesCache.get(url);

	/**
	 * @todo Make sure we have a size?
	 */
	if (!cache) {
		if (options.size) return { data: new Uint8Array(0), missing: [{ start: 0, end: options.size ?? 0 }] };
		options.warn?.(url + ': Size not provided and cache is empty, can not determine missing range');
		return { data: undefined, missing: [] };
	}

	const { start = 0, end = cache.size } = options;

	const data = new Uint8Array(end - start);

	for (const region of cache.regions) {
		if (region.offset + region.data.byteLength <= start) continue;
		if (region.offset >= end) break;

		for (const range of region.ranges) {
			if (range.end <= start) continue;
			if (range.start >= end) break;

			const overlapStart = Math.max(range.start, start);
			const overlapEnd = Math.min(range.end, end);

			if (overlapStart >= overlapEnd) continue;

			data.set(region.data.subarray(overlapStart - region.offset, overlapEnd - region.offset), overlapStart - start);
		}
	}

	return { data, missing: cache.missing(start, end) };
}

interface SetOptions extends Options {
	/** The offset we are updating at */
	offset?: number;

	/** If a cache for the resource doesn't exist, this will be used as the full size */
	size?: number;
}

/**
 * Make a POST request to set (or create) data on the server and update the cache.
 * @throws RequestError
 */
export async function set(url: string, data: Uint8Array, options: SetOptions, init: RequestInit = {}): Promise<void> {
	if (!resourcesCache.has(url)) {
		new ResourceCache(url, options.size ?? data.byteLength, options);
	}

	const cache = resourcesCache.get(url)!;

	const { offset = 0 } = options;

	if (!options.cacheOnly) await _fetch(new Request(url, init), { method: 'POST' }, true);

	cache.add(data, offset).collect();
}

/**
 * Make a DELETE request to remove the resource from the server and clear it from the cache.
 * @throws RequestError
 */
export async function remove(url: string, options: Options = {}, init: RequestInit = {}): Promise<void> {
	if (!options.cacheOnly) await _fetch(new Request(url, init), { method: 'DELETE' }, true);
	resourcesCache.delete(url);
}
