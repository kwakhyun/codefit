/** Saves text as a file in the browser; Markdown and plain text share this path. */
export function downloadFile(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Quotes learner-written text so Markdown never renders it as headings or lists. */
export function markdownQuote(text: string) {
  return text
    .trim()
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}
