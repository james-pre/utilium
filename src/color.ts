// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2026 James Prevett

export type RGB = [r: number, g: number, b: number];
export type HSL = [h: number, s: number, l: number];
export type HSV = [h: number, s: number, v: number];

/**
 * Converts a hex string to RGB.
 * `#` is optional.
 */
export function hexToRGB(hex: string): RGB {
	if (hex[0] == '#') hex = hex.slice(1);
	return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/**
 * @returns RGB values in hex format.
 * Does not include a leading `#` (in case you want to do something else with the value)
 */
export function rgbToHex(r: number, g: number, b: number): string {
	return r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

/**
 * Converts RGB to HSL.
 * @see https://en.wikipedia.org/wiki/HSL_and_HSV
 */
export function rgbToHSL(r: number, g: number, b: number): HSL {
	r /= 255;
	g /= 255;
	b /= 255;

	const min = Math.min(r, g, b),
		max = Math.max(r, g, b);

	const l = (max + min) / 2;

	const delta = max - min;

	if (delta === 0) return [0, 0, l];

	const sat = delta / (l > 0.5 ? 2 - max - min : max + min);
	const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
	return [hue / 6, sat, l];
}

function hueToRGB(p: number, q: number, t: number) {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1 / 6) return Math.round(255 * (p + (q - p) * 6 * t));
	if (t < 1 / 2) return Math.round(255 * q);
	if (t < 2 / 3) return Math.round(255 * (p + (q - p) * (2 / 3 - t) * 6));
	return Math.round(255 * p);
}

/**
 * Converts HSL to RGB
 * @see https://en.wikipedia.org/wiki/HSL_and_HSV
 */
export function hslToRGB(h: number, s: number, l: number): RGB {
	if (s === 0) {
		l = Math.round(l * 255);
		return [l, l, l];
	}

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;

	return [hueToRGB(p, q, h + 1 / 3), hueToRGB(p, q, h), hueToRGB(p, q, h - 1 / 3)];
}

/**
 * Converts RGB to HSV
 * @see https://en.wikipedia.org/wiki/HSL_and_HSV
 */
export function rgbToHSV(r: number, g: number, b: number): HSV {
	r /= 255;
	g /= 255;
	b /= 255;

	const min = Math.min(r, g, b),
		max = Math.max(r, g, b);

	const delta = max - min;
	const sat = max == 0 ? 0 : delta / max;

	if (delta === 0) return [0, sat, max];

	const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
	return [hue / 6, sat, max];
}

/**
 * Converts HSV to RGB.
 * @see https://en.wikipedia.org/wiki/HSL_and_HSV
 */
export function hsvToRGB(h: number, s: number, v: number): RGB {
	v = Math.round(v * 255);

	const i = Math.floor(h * 6);
	const f = h * 6 - i;
	const p = Math.round(v * (1 - s));
	const q = Math.round(v * (1 - f * s));
	const t = Math.round(v * (1 - (1 - f) * s));

	switch (i % 6) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}

	throw new Error('Unreachable code in hsvToRGB');
}

/**
 * Converts a hex string to HSL.
 */
export function hexToHSL(hex: string): HSL {
	return rgbToHSL(...hexToRGB(hex));
}

/**
 * Converts HSL to a hex string.
 */
export function hslToHex(h: number, s: number, l: number): string {
	return rgbToHex(...hslToRGB(h, s, l));
}

/**
 * Converts a hex string to HSV.
 */
export function hexToHSV(hex: string): HSV {
	return rgbToHSV(...hexToRGB(hex));
}

/**
 * Converts HSV to a hex string.
 */
export function hsvToHex(h: number, s: number, v: number): string {
	return rgbToHex(...hsvToRGB(h, s, v));
}

/**
 * Converts HSL to HSV.
 */
export function hslToHSV(h: number, s: number, l: number): HSV {
	const v = l + s * Math.min(l, 1 - l);
	const newS = v === 0 ? 0 : 2 * (1 - l / v);
	return [h, newS, v];
}

/**
 * Converts HSV to HSL.
 */
export function hsvToHSL(h: number, s: number, v: number): HSL {
	const l = v * (1 - s / 2);
	const newS = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
	return [h, newS, l];
}
