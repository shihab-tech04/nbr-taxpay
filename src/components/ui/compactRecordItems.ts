/** Immutable, bounded projection for dense table and mobile record cells.
 * This helper never mutates or discards the source list; full record detail
 * remains with the owner of the list.
 */
export function compactRecordItems<Item>(items:readonly Item[],visibleCount=1) {
  const requested=Number.isFinite(visibleCount)?Math.trunc(visibleCount):1;
  const limit=Math.max(1,requested);
  return {
    visible:items.slice(0,limit),
    hiddenCount:Math.max(0,items.length-limit),
    totalCount:items.length
  };
}
