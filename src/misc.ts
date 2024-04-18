export function wait(time: number) {
	return new Promise(resolve => setTimeout(resolve, time));
}

export const greekLetterNames = [
	'Alpha',
	'Beta',
	'Gamma',
	'Delta',
	'Epsilon',
	'Zeta',
	'Eta',
	'Theta',
	'Iota',
	'Kappa',
	'Lambda',
	'Mu',
	'Nu',
	'Xi',
	'Omicron',
	'Pi',
	'Rho',
	'Sigma',
	'Tau',
	'Upsilon',
	'Phi',
	'Chi',
	'Psi',
	'Omega',
];

const hexRegex = /^[0-9a-f-.]+$/;

export function isHex(str: string) {
	return hexRegex.test(str);
}
