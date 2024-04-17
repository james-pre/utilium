export function randomFloat(min = 0, max = 1): number {
	return Math.random() * (max - min) + min;
}

export function randomHex(length = 1): string {
	let s = '';
	for (let i = 0; i < length; i++) {
		s += Math.floor(Math.random() * 16).toString(16);
	}
	return s;
}

export function randomBoolean(): boolean {
	return !!Math.round(Math.random());
}

export function randomBinaryString(length = 1): string {
	let b = '';
	for (let i = 0; i < length; i++) {
		b += Math.round(Math.random());
	}
	return b;
}

export function randomInt(min = 0, max = 1): number {
	return Math.round(Math.random() * (max - min) + min);
}
