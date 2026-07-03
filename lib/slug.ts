// URL slug from arbitrary text: strip diacritics, lowercase, and collapse any
// run of non-alphanumerics to a single hyphen. Shared by posts and events.
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
