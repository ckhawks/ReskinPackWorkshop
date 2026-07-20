/**
 * Minimal Steam-Workshop BBCode → HTML renderer for the description preview.
 *
 * This is an approximation of how Steam renders item descriptions — enough to
 * catch formatting mistakes before publishing. It is NOT a full parser; unknown
 * tags are left as-is. Input is HTML-escaped first, so it's safe to inject.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bbcodeToHtml(input: string): string {
  if (!input) return "";
  let s = escapeHtml(input);

  // [noparse] — keep the inner text literal; we simply drop the tags since the
  // content is already escaped.
  s = s.replace(/\[noparse\]/gi, "").replace(/\[\/noparse\]/gi, "");

  // Headings
  s = s
    .replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, "<h1>$1</h1>")
    .replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, "<h2>$1</h2>")
    .replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, "<h3>$1</h3>");

  // Block quotes ([quote] and [quote=author])
  s = s
    .replace(/\[quote=([^\]]*)\]/gi, "<blockquote><cite>$1</cite>")
    .replace(/\[quote\]/gi, "<blockquote>")
    .replace(/\[\/quote\]/gi, "</blockquote>");

  // Code
  s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "<pre><code>$1</code></pre>");

  // Lists
  s = s
    .replace(/\[list\]/gi, "<ul>")
    .replace(/\[\/list\]/gi, "</ul>")
    .replace(/\[olist\]/gi, "<ol>")
    .replace(/\[\/olist\]/gi, "</ol>")
    .replace(/\[\*\]\s?/gi, "<li>");

  // Inline styles
  s = s
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>")
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>")
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>")
    .replace(/\[strike\]([\s\S]*?)\[\/strike\]/gi, "<s>$1</s>")
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>")
    .replace(
      /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
      '<span class="bb-spoiler">$1</span>'
    );

  // Images
  s = s.replace(
    /\[img\]([\s\S]*?)\[\/img\]/gi,
    '<img src="$1" alt="" class="bb-img" />'
  );

  // Links: [url=target]label[/url] and [url]target[/url]
  s = s
    .replace(
      /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
      '<a href="$1" target="_blank" rel="noreferrer">$2</a>'
    )
    .replace(
      /\[url\]([\s\S]*?)\[\/url\]/gi,
      '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
    );

  // Auto-link bare URLs (Steam does this too). The lookbehind avoids URLs that
  // are already inside an href="…" or as anchor text of the tags handled above.
  s = s.replace(
    /(?<!["'>=])(https?:\/\/[^\s<]+[^\s<.,!?)])/gi,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  );

  // Horizontal rule
  s = s.replace(/\[hr\]\[\/hr\]/gi, "<hr />").replace(/\[hr\]/gi, "<hr />");

  // Remaining newlines → line breaks (block tags already introduce spacing).
  s = s.replace(/\r\n?/g, "\n").replace(/\n/g, "<br />");

  return s;
}
