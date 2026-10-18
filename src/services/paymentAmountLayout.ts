/** Arrange payment amounts in pairs, with an odd final field taking a full row. */
export function paymentAmountRowColumns(fieldCount: number): number[] {
  const columns: number[] = [];
  let remaining = Math.max(0, Math.trunc(fieldCount));

  while (remaining > 0) {
    const inRow = Math.min(remaining, 2);
    for (let index = 0; index < inRow; index += 1) columns.push(inRow);
    remaining -= inRow;
  }

  return columns;
}
