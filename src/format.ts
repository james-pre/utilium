// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2026 James Prevett

/** Lengths are in milliseconds */
const rangeUnits = [
	['day', 24 * 3600_000],
	['hour', 3600_000],
	['minute', 60_000],
] as const;

export function dateRange(date: Date): string {
	const offset = date.getTime() - Date.now();
	const distance = Math.abs(offset);

	const [unit, length] = rangeUnits.find(([, length]) => distance >= length) ?? rangeUnits.at(-1)!;
	const count = Math.round(distance / length);
	const text = `${count} ${unit}${count == 1 ? '' : 's'}`;

	return `${date.toLocaleString()} (${offset >= 0 ? `in ${text}` : `${text} ago`})`;
}

export function bytes(bytes: bigint | number): string {
	if (typeof bytes == 'number') {
		bytes = BigInt(bytes);
	}

	const units = ['B', 'KB', 'MB', 'GB', 'TB'];

	const i = bytes == 0n ? 0 : Math.floor((bytes.toString(10).length - 1) / 3);
	const value = bytes == 0n ? 0 : Number(bytes) / Math.pow(1000, i);

	return `${Number.isInteger(value) ? value : value.toFixed(2)} ${units[i]}`;
}

export function ms(time: number): string {
	return time > 5000 ? (time / 1000).toFixed(2) + 's' : time + 'ms';
}

/** Formats a short duration into colon-separated values */
export function duration(seconds: number): string {
	if (!Number.isFinite(seconds)) return '--:--';

	seconds = Math.floor(seconds);
	let minutes = Math.floor(seconds / 60);
	seconds %= 60;
	const hours = Math.floor(minutes / 60);
	minutes %= 60;
	const secondsStr = ':' + seconds.toString().padStart(2, '0');
	return hours ? `${hours}:${minutes.toString().padStart(2, '0')}${secondsStr}` : minutes + secondsStr;
}
