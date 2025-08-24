// SPDX-License-Identifier: LGPL-3.0-or-later
/**
 * Shared eslint rules
 * Copyright (c) 2025 James Prevett
 */
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default function (tsconfigRootDir) {
	return tseslint.config(
		{
			name: 'Utilium',
			extends: [eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
			files: ['src/**/*.ts', 'tests/**/*.ts'],
			languageOptions: {
				globals: { ...globals.browser, ...globals.node },
				ecmaVersion: 'latest',
				sourceType: 'module',
				parserOptions: {
					projectService: true,
					tsconfigRootDir,
				},
			},
			rules: {
				'no-useless-escape': 'warn',
				'no-unreachable': 'warn',
				'no-fallthrough': 'warn',
				'no-empty': 'warn',
				'no-case-declarations': 'warn',
				'prefer-const': 'warn',
				'prefer-rest-params': 'warn',
				'prefer-spread': 'warn',
				'no-unused-vars': 'off',
				'@typescript-eslint/no-unused-vars': 'warn',
				'@typescript-eslint/no-inferrable-types': 'off',
				'@typescript-eslint/no-this-alias': 'off',
				'@typescript-eslint/no-unsafe-function-type': 'warn',
				'@typescript-eslint/no-wrapper-object-types': 'warn',
				'@typescript-eslint/triple-slash-reference': 'warn',
				'@typescript-eslint/no-non-null-assertion': 'off',
				'@typescript-eslint/no-namespace': 'warn',
				'@typescript-eslint/prefer-as-const': 'warn',
				'@typescript-eslint/no-explicit-any': 'warn',
				'@typescript-eslint/consistent-type-assertions': 'warn',
				'@typescript-eslint/consistent-type-imports': 'warn',
				'@typescript-eslint/no-unnecessary-type-assertion': 'warn',
				'@typescript-eslint/require-await': 'warn',
				'@typescript-eslint/no-unsafe-return': 'off',
				'@typescript-eslint/no-unsafe-assignment': 'off',
				'@typescript-eslint/no-unsafe-member-access': 'off',
				'@typescript-eslint/no-unsafe-argument': 'off',
				'@typescript-eslint/no-redundant-type-constituents': 'warn',
				'@typescript-eslint/no-unsafe-call': 'warn',
				'@typescript-eslint/restrict-plus-operands': 'off',
			},
		},
		{
			name: 'Tests overrides',
			files: ['tests/**/*.ts'],
			rules: {
				'@typescript-eslint/no-unsafe-member-access': 'off',
				'@typescript-eslint/no-unsafe-argument': 'off',
				'@typescript-eslint/no-unsafe-assignment': 'off',
				'@typescript-eslint/no-floating-promises': 'off',
				'@typescript-eslint/no-explicit-any': 'off',
			},
		}
	);
}
