/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a number to Bangladeshi Taka (BDT) with South Asian numbering formatting and the ৳ symbol.
 * @param val The numeric amount to format.
 * @param fractionDigits Number of decimal places.
 */
export function formatBDT(val: number, fractionDigits = 0): string {
  const parsed = Number(val);
  if (isNaN(parsed)) return "৳0";
  
  return "৳" + parsed.toLocaleString("en-BD", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}
