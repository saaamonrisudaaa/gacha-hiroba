/* 月別新作ページを検索対象にするための最低掲載件数。
   独自集計が成立しない少数掲載の月は、閲覧可能なまま noindex にする。 */
export const MIN_INDEXABLE_RELEASES = 8;

export function isIndexableReleaseCount(count) {
  return Number.isInteger(count) && count >= MIN_INDEXABLE_RELEASES;
}
