// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett
/* eslint-disable @typescript-eslint/no-unused-expressions */

/**
 * Upload a file
 * @todo use Promise.withResolvers
 */
export function upload(type?: string, multiple = false): Promise<File> {
	return new Promise<File>((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		if (type) input.accept = type;

		if (multiple) input.multiple = true;

		input.addEventListener('change', e => {
			const file = input.files?.[0];
			file ? resolve(file) : reject(new ReferenceError('No files uploaded'));
		});

		input.click();
	});
}

/**
 * Downloads some data
 */
export function download(name: string, ...parts: BlobPart[]): void {
	const link = document.createElement('a');
	link.href = URL.createObjectURL(new Blob(parts));
	link.download = name;
	link.click();
}

/**
 * Create an instance of a `<template>`
 */
export function cloneTemplate(selector: string): DocumentFragment {
	const template = document.querySelector<HTMLTemplateElement>(selector);
	if (!template) {
		throw new ReferenceError('Template does not exist: ' + selector);
	}
	return template.content.cloneNode(true) as DocumentFragment;
}
