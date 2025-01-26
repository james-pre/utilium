/* Utilities for `fetch` when using range requests. It also allows you to handle errors easier */

import { extendBuffer } from './buffer.js';

/* eslint-disable @typescript-eslint/only-throw-error */

export interface ResourceCacheOptions {
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
}

type CacheRange = { start: number; end: number };

interface CacheRegion {
	/** The region's offset from the start of the resource */
	offset: number;

	/** Ranges cached in this region. These are absolute! */
	ranges: CacheRange[];

	/** Data for this region */
	data: Uint8Array;
}

/** The cache for a specific resource */
class ResourceCache {
	/** Regions used to reduce unneeded allocations. Think of sparse arrays. */
	protected readonly regions: CacheRegion[] = [];

	public constructor(
		/** The resource URL */
		public readonly url: string,
		/** The full size of the resource */
		public readonly size: number,
		protected readonly options: ResourceCacheOptions
	) {
		options.sparse ??= true;
		if (!options.sparse) this.regions.push({ offset: 0, data: new Uint8Array(size), ranges: [] });

		requestsCache.set(url, this);
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
	public add(data: Uint8Array, start: number, end: number = start + data.byteLength): this {
		const region = this.regionAt(start);

		if (region) {
			region.data = extendBuffer(region.data, end);
			region.ranges.push({ start, end });
			region.ranges.sort((a, b) => a.start - b.start);

			return this;
		}

		// Find the correct index to insert the new region
		const newRegion: CacheRegion = { data, offset: start, ranges: [{ start, end }] };
		const insertIndex = this.regions.findIndex(region => region.offset > start);

		// Insert at the right index to keep regions sorted
		if (insertIndex == -1) {
			this.regions.push(newRegion); // Append if no later region exists
		} else {
			this.regions.splice(insertIndex, 0, newRegion); // Insert before the first region with a greater offset
		}

		return this;
	}
}

const requestsCache = new Map<string, ResourceCache | null>();

export type RequestError = { tag: 'status'; response: Response } | { tag: 'buffer'; response: Response; message: string } | { tag: 'fetch' | 'size'; message: string } | Error;

/**
 * Wraps `fetch`
 * @throws RequestError
 */
async function _fetchBuffer(input: RequestInfo, init: RequestInit = {}): Promise<{ response: Response; data: Uint8Array }> {
	const response = await fetch(input, init).catch((error: Error) => {
		throw { tag: 'fetch', message: error.message } satisfies RequestError;
	});

	if (!response.ok) throw { tag: 'status', response } satisfies RequestError;

	const arrayBuffer = await response.arrayBuffer().catch((error: Error) => {
		throw { tag: 'buffer', response, message: error.message } satisfies RequestError;
	});

	return { response, data: new Uint8Array(arrayBuffer) };
}

export interface RequestOptions extends ResourceCacheOptions {
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

	/** Optionally provide a function for logging warnings */
	warn?(message: string): unknown;
}

/**
 * Make a GET request without worrying about ranges
 * @throws RequestError
 */
export async function GET(url: string, options: RequestOptions, init: RequestInit = {}): Promise<Uint8Array> {
	const req = new Request(url, init);

	// Request no using ranges
	if (typeof options.start != 'number' || typeof options.end != 'number') {
		const { data } = await _fetchBuffer(url, init);
		new ResourceCache(url, data.byteLength, options).add(data, 0);
		return data;
	}

	// Range requests

	if (typeof options.size != 'number') {
		options.warn?.(url + ': Size not provided, an additional HEAD request is being made');

		const { headers } = await fetch(req, { method: 'HEAD' });
		const size = parseInt(headers.get('Content-Length') ?? '');
		if (typeof size != 'number') throw { tag: 'size', message: 'Response is missing content-length header and no size was provided' } satisfies RequestError;
		options.size = size;
	}

	const { size, start, end } = options;
	const cache = requestsCache.get(url) ?? new ResourceCache(url, size, options);

	req.headers.set('If-Range', new Date().toUTCString());

	for (const { start: from, end: to } of cache.missing(start, end)) {
		const { data, response } = await _fetchBuffer(req, { headers: { Range: `bytes=${from}-${to}` } });

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
