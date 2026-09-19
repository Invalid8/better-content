const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (char) => ESCAPES[char]);

const safeHref = (href: string) =>
  /^(https?:|mailto:|\/|#)/i.test(href) ? href : "#";

const inline = (block: string) =>
  escapeHtml(block)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
      (_match, label: string, href: string) =>
        `<a href="${safeHref(href)}" target="_blank" rel="noreferrer">${label}</a>`,
    )
    .replace(/\n/g, "<br />");

// The library ships no parser: rendering the string is the consumer's call,
// and this is the demo making it.
export function renderMarkdown(source: string): string {
  return source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${inline(block)}</p>`)
    .join("");
}
