// Safe serialization for <script type="application/ld+json">: escapes "<" so a
// closing-tag sequence ("</script>") embedded in DB-sourced content (e.g. a
// product description) can't break out of the surrounding script element.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
