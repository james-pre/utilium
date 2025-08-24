#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, matchesGlob, relative } from 'node:path';
import { parseArgs, styleText } from 'node:util';

const { positionals: dirs, values: opts } = parseArgs({
	allowPositionals: true,
	options: {
		auto: { type: 'boolean', short: 'a', default: false },
		exclude: { type: 'string', short: 'x', default: [], multiple: true },
		force: { type: 'boolean', short: 'f', default: false },
		help: { type: 'boolean', short: 'h', default: false },
		license: { type: 'string', short: 'l' },
		verbose: { type: 'boolean', short: 'v', default: false },
		write: { type: 'boolean', short: 'w', default: false },
	},
});

if (opts.help) {
	console.error(`Usage: lice [options] <dirs...>

Options:
    -f, --force         Force overwrite of existing license headers
    -h, --help          Show this help message
    -a, --auto          Detect the SPDX identifier in package.json
    -l, --license       Specify the SPDX license identifier to check for.
    -v, --verbose       Enable verbose output
    -w, --write         Write the license header if missing
    -x, --exclude       Glob pattern to exclude files
`);
	process.exit(0);
}

/**
 *
 * @returns {string|null}
 */
function get_license() {
	for (let dir = process.cwd(); dir != '/'; dir = dirname(dir)) {
		const pkgPath = join(dir, 'package.json');
		if (!existsSync(pkgPath)) continue;

		const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
		if (pkg.spdx) return pkg.spdx;
		if (pkg.spdxLicense) return pkg.spdxLicense;
		if (pkg.license) return pkg.license;
	}

	return null;
}

const expectedLicense = opts.license || (opts.auto && get_license());

if (opts.write && !expectedLicense) {
	console.error(styleText('red', 'You must specify a license to write.'));
	process.exit(1);
}

function should_exclude(path, display) {
	for (const pattern of opts.exclude) {
		if (!matchesGlob(path, pattern)) continue;
		console.log(styleText('whiteBright', 'Skipped:'), display);
		return true;
	}

	return false;
}

const licenseSpec = /^\s*\/(?:\/|\*) SPDX-License-Identifier: (.+)/;

async function check_file(path, display) {
	if (should_exclude(path, display)) return 'skipped';

	const content = await readFile(path, 'utf-8');

	const match = licenseSpec.exec(content);

	if (!match) {
		console.error(styleText('red', 'Missing:'), display);
		return 'missing';
	}

	if (!expectedLicense) {
		if (opts.verbose) console.log(styleText(['dim'], 'Found:'), display);
		return 'with license';
	}

	const [, license] = match;

	if (license == expectedLicense) {
		if (opts.verbose) console.log(styleText(['green', 'dim'], 'Correct:'), display);
		return 'correct';
	}

	console.warn(styleText('yellow', 'Mismatch:'), display);
	return 'mismatched';
}

async function write_file(path, display) {
	if (should_exclude(path, display)) return 'skipped';

	const content = await readFile(path, 'utf-8');

	const match = licenseSpec.exec(content);

	if (!match) {
		await writeFile(path, `// SPDX-License-Identifier: ${expectedLicense}\n${content}`, 'utf-8');

		console.log('Added: ' + display);
		return 'added';
	}

	const [, license] = match;

	if (license == expectedLicense) {
		if (opts.verbose) console.log(styleText(['green', 'dim'], 'Correct:'), display);
		return 'correct';
	}

	process.stdout.write(styleText('yellow', 'Mismatch: ') + display);

	if (!opts.force) {
		console.log(styleText('whiteBright', ' (skipped)'));
		return 'skipped';
	}

	await writeFile(path, content.replace(licenseSpec, `// SPDX-License-Identifier: ${expectedLicense}`), 'utf-8');
	console.log(styleText('whiteBright', ' (overwritten)'));
	return 'overwritten';
}

function check_dir(dir, display) {
	if (should_exclude(dir, display)) return 'skipped';

	const entries = readdirSync(dir, { withFileTypes: true });

	const results = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			results.push(...check_dir(join(dir, entry.name), join(display, entry.name)));
			continue;
		}

		if (!entry.isFile()) continue;

		const op = opts.write ? write_file : check_file;
		results.push(op(join(dir, entry.name), join(display, entry.name)));
	}

	return results;
}

if (!dirs.length) {
	console.error(styleText('red', 'No directories specified'));
	process.exit(1);
}

if (opts.verbose) console.log('Checking:', dirs.join(', '));

const promises = [];

for (const dir of dirs) {
	const rel = relative(process.cwd(), dir);
	promises.push(...check_dir(dir, rel.startsWith('..') ? dir : rel));
}

const styles = Object.assign(Object.create(null), {
	missing: 'red',
	'with license': 'white',
	correct: 'green',
	mismatched: 'yellow',
	skipped: 'white',
	added: 'cyan',
	overwritten: 'magenta',
});

try {
	const raw_results = await Promise.all(promises);
	const results = Object.create(null);
	for (const result of raw_results) {
		if (!(result in results)) results[result] = 0;
		results[result]++;
	}
	console.log(
		opts.write ? 'Wrote' : 'Checked',
		styleText('blueBright', raw_results.length.toString()),
		'files:',
		Object.entries(results)
			.map(([key, value]) => `${key in styles ? styleText(styles[key], value.toString()) : value} ${key}`)
			.join(', ')
	);
} catch (error) {
	console.error(styleText('red', error.toString()));
	process.exit(1);
}
