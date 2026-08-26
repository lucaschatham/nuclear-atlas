export function csvCell(value) {
  if (value === null || value === undefined) return ""
  let text = String(value)
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text.trimStart())) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
