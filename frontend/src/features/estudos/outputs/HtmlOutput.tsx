import DOMPurify from "dompurify";
import { useMemo } from "react";

/** Saídas `text/html` (os DataFrames do pandas) sanitizadas — sem <style> nem <script>. */
export function HtmlOutput({ html }: { html: string }) {
  const limpo = useMemo(() => DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "script"], FORBID_ATTR: ["style"] }), [html]);
  return <div className="saida-html overflow-x-auto text-sm" dangerouslySetInnerHTML={{ __html: limpo }} />;
}
