export function range(min: number, max: number): number[] {
	const a = [];
	for (let i = min; i < max; i++) {
		a.push(i);
	}
	return a;
}

export function toDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

export function toRadians(degrees: number): number {
	return (degrees / 180) * Math.PI;
}
