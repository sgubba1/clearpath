// Every word in the query must appear somewhere across the fields, in any order and any case.
// "home lo" matches "Fall home project loans"; "maya card" matches Maya's card ads.
export function matchesQuery(query: string | undefined, ...fields: (string | null | undefined)[]) {
  const words = query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function searchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}
