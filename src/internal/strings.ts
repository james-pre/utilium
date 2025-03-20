import { encodeASCII } from '../string.js';

export function raw(text: string): Uint8Array {
	return encodeASCII(text);
}
