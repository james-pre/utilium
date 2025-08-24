// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Add, Divide, Fraction, Integer, Multiply, Subtract } from './type-math.js';

// addition

const add_positive: Add<1, 2> = 3 as const;
const add_zero: Add<0, 0> = 0 as const;
const add_diff_signs: Add<1, -2> = -1 as const;
const add_negative: Add<-1, -2> = -3 as const;
const add_float: Add<0.6, 1.1> = 1.7 as const;

// @ts-expect-error 2 + 2 != 5
let fail: Add<2, 2> = 5 as const;
fail = 4;

// subtraction for sanity

const subtract_normal: Subtract<2, 20> = -18 as const;
const subtract_from_neg: Subtract<-5, 4> = -9 as const;
const subtract_both_neg: Subtract<-5, -10> = 5 as const;
const subtract_zero: Subtract<0, 1> = -1 as const;

// were doing multiplication in the type system now?!
// yup.

const multiply_normal: Multiply<2, 3> = 6 as const;
const multiply_by_zero: Multiply<0, 10> = 0 as const;
const multiply_negative: Multiply<-1, 12> = -12 as const;
const multiply_both_negative: Multiply<-3, -7> = 21 as const;
const multiply_large: Multiply<128, 7> = 896 as const;

// division

const divide_normal: Divide<10, 2> = 5 as const;
const divide_by_zero: Divide<1, 0> = NaN as never;
const divide_negative: Divide<-20, 5> = -4 as const;
const divide_both_negative: Divide<-18, -3> = 6 as const;

// floor/fraction

const int_normal: Integer<3.1415> = 3 as const;
const int_negative: Integer<-3.1415> = -3 as const;
const fraction_normal: Fraction<3.1415> = 0.1415 as const;
const fraction_negative: Fraction<-3.1415> = 0.1415 as const;

// With type variable

const pi = 3.141 as const;
const octo_pi: Multiply<typeof pi, 8> = 24.1128;
