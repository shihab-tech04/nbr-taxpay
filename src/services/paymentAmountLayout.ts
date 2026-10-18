/** Balance payment amount fields into full-width rows of at most three columns.
 * The final four fields become two equal pairs rather than 3 + 1.
 */
export function paymentAmountRowColumns(fieldCount: number): number[] {
  const columns: number[] = [];
  let remaining = Math.max(0, Math.trunc(fieldCount));

  while (remaining > 0) {
    const inRow = remaining === 4 ? 2 : Math.min(remaining, 3);
    for (let index = 0; index < inRow; index += 1) columns.push(inRow);
    remaining -= inRow;
  }

  return columns;
}
