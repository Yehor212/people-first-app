import { describe, it, expect } from "vitest";
import { sanitizeString, sanitizeUserName, sanitizeRichContent } from "@/lib/sanitize";

// ─── sanitizeString ──────────────────────────────────────────────

describe("sanitizeString", () => {
  it("passes through normal text unchanged", () => {
    expect(sanitizeString("Hello World")).toBe("Hello World");
  });

  it("strips HTML bold tags, keeping inner text", () => {
    expect(sanitizeString("<b>bold</b>")).toBe("bold");
  });

  it("handles empty string returning empty", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  // ─── XSS payloads ────────────────────────────────────────────

  describe("XSS payloads", () => {
    it("strips <script> tags and their content", () => {
      expect(sanitizeString("<script>alert(1)</script>")).toBe("");
    });

    it("strips nested script tags", () => {
      expect(sanitizeString('<script><script>alert("xss")</script></script>')).toBe("");
    });

    it("strips javascript: protocol", () => {
      const result = sanitizeString("javascript:alert(1)");
      expect(result).not.toContain("javascript:");
    });

    it("strips JAVASCRIPT: (case-insensitive)", () => {
      const result = sanitizeString("JAVASCRIPT:alert(1)");
      expect(result).not.toContain("JAVASCRIPT:");
      expect(result).not.toContain("javascript:");
    });

    it("strips jAvAsCrIpT: (mixed case)", () => {
      const result = sanitizeString("jAvAsCrIpT:void(0)");
      expect(result).not.toContain("jAvAsCrIpT:");
    });

    it("strips data: protocol", () => {
      const result = sanitizeString("data:text/html,<h1>hi</h1>");
      expect(result).not.toContain("data:");
    });

    it("strips vbscript: protocol", () => {
      const result = sanitizeString('vbscript:MsgBox("hi")');
      expect(result).not.toContain("vbscript:");
    });

    it("strips onclick= attribute pattern", () => {
      const result = sanitizeString("onclick=alert(1)");
      expect(result).not.toContain("onclick=");
    });

    it("strips onerror= attribute pattern", () => {
      const result = sanitizeString("onerror=doEvil()");
      expect(result).not.toContain("onerror=");
    });

    it("strips OnClick= (case-insensitive)", () => {
      const result = sanitizeString("OnClick=doStuff()");
      expect(result).not.toContain("OnClick=");
      expect(result).not.toContain("onclick=");
    });

    it("strips onmouseover= pattern", () => {
      const result = sanitizeString("onmouseover=steal()");
      expect(result).not.toContain("onmouseover=");
    });

    it("strips eval() calls", () => {
      const result = sanitizeString("eval(code)");
      expect(result).not.toContain("eval(");
    });

    it("strips expression() calls", () => {
      const result = sanitizeString("expression(evil)");
      expect(result).not.toContain("expression(");
    });

    it("strips url() calls", () => {
      const result = sanitizeString("url(http://evil.com)");
      expect(result).not.toContain("url(");
    });

    it("strips img tag with onerror payload", () => {
      const result = sanitizeString("<img src=x onerror=alert(1)>");
      expect(result).not.toContain("<img");
      expect(result).not.toContain("onerror");
    });

    it("strips svg/onload payload", () => {
      const result = sanitizeString("<svg/onload=alert(1)>");
      expect(result).not.toContain("<svg");
      expect(result).not.toContain("onload");
    });

    it("strips iframe tags", () => {
      const result = sanitizeString('<iframe src="http://evil.com"></iframe>');
      expect(result).not.toContain("<iframe");
      expect(result).not.toContain("</iframe");
    });
  });

  // ─── Character removal ───────────────────────────────────────

  describe("character removal", () => {
    it("removes angle brackets < >", () => {
      const result = sanitizeString("a < b > c");
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("removes curly braces { }", () => {
      const result = sanitizeString("obj { key: val }");
      expect(result).not.toContain("{");
      expect(result).not.toContain("}");
    });

    it("removes backslashes", () => {
      expect(sanitizeString("path\\to\\file")).toBe("pathtofile");
    });
  });

  // ─── Length truncation ────────────────────────────────────────

  describe("length truncation", () => {
    it("truncates at 1000 characters", () => {
      const long = "a".repeat(1500);
      expect(sanitizeString(long).length).toBe(1000);
    });

    it("does not truncate string of exactly 1000 characters", () => {
      const exact = "b".repeat(1000);
      expect(sanitizeString(exact).length).toBe(1000);
      expect(sanitizeString(exact)).toBe(exact);
    });

    it("does not truncate string shorter than 1000", () => {
      const short = "c".repeat(500);
      expect(sanitizeString(short)).toBe(short);
    });
  });

  // ─── Unicode and edge cases ───────────────────────────────────

  describe("unicode and edge cases", () => {
    it("handles Cyrillic text", () => {
      expect(sanitizeString("Привет мир")).toBe("Привет мир");
    });

    it("handles Japanese text", () => {
      expect(sanitizeString("こんにちは世界")).toBe("こんにちは世界");
    });

    it("handles Arabic text", () => {
      expect(sanitizeString("مرحبا بالعالم")).toBe("مرحبا بالعالم");
    });

    it("handles emoji characters", () => {
      expect(sanitizeString("Hello 🌍🌎🌏")).toBe("Hello 🌍🌎🌏");
    });

    it("handles string of only whitespace", () => {
      expect(sanitizeString("   ")).toBe("");
    });

    it("handles string with newlines and tabs", () => {
      const result = sanitizeString("line1\nline2\ttab");
      expect(result).toContain("line1");
      expect(result).toContain("line2");
    });

    it("handles very long XSS payload within truncation", () => {
      const payload = "<script>" + "x".repeat(2000) + "</script>";
      const result = sanitizeString(payload);
      expect(result.length).toBeLessThanOrEqual(1000);
      expect(result).not.toContain("<script");
    });
  });
});

// ─── sanitizeUserName ────────────────────────────────────────────

describe("sanitizeUserName", () => {
  it("passes clean name through", () => {
    expect(sanitizeUserName("Alice")).toBe("Alice");
  });

  it("sanitizes HTML in name", () => {
    expect(sanitizeUserName("<b>Bob</b>")).toBe("Bob");
  });

  it("handles empty string", () => {
    expect(sanitizeUserName("")).toBe("");
  });

  it("handles unicode names", () => {
    expect(sanitizeUserName("Олександр")).toBe("Олександр");
  });

  // ─── Length truncation ────────────────────────────────────────

  describe("length truncation", () => {
    it("truncates at 100 characters", () => {
      const longName = "A".repeat(200);
      expect(sanitizeUserName(longName).length).toBe(100);
    });

    it("does not truncate name of exactly 100 characters", () => {
      const exact = "B".repeat(100);
      expect(sanitizeUserName(exact).length).toBe(100);
    });

    it("does not truncate short name", () => {
      const name = "Charlie";
      expect(sanitizeUserName(name)).toBe(name);
    });
  });

  // ─── XSS in usernames ────────────────────────────────────────

  describe("XSS payloads in names", () => {
    it("strips script tags from name", () => {
      const result = sanitizeUserName('<script>alert("name")</script>');
      expect(result).not.toContain("<script");
    });

    it("strips javascript: from name", () => {
      const result = sanitizeUserName("javascript:void(0)");
      expect(result).not.toContain("javascript:");
    });

    it("strips onclick from name", () => {
      const result = sanitizeUserName("onclick=steal()");
      expect(result).not.toContain("onclick=");
    });
  });
});

// ─── sanitizeRichContent ─────────────────────────────────────────

describe("sanitizeRichContent", () => {
  // ─── Allowlisted tags ─────────────────────────────────────────

  describe("allowed tags", () => {
    it("preserves <b> tags", () => {
      expect(sanitizeRichContent("<b>bold</b>")).toBe("<b>bold</b>");
    });

    it("preserves <strong> tags", () => {
      expect(sanitizeRichContent("<strong>strong</strong>")).toBe("<strong>strong</strong>");
    });

    it("preserves <i> tags", () => {
      expect(sanitizeRichContent("<i>italic</i>")).toBe("<i>italic</i>");
    });

    it("preserves <em> tags", () => {
      expect(sanitizeRichContent("<em>emphasis</em>")).toBe("<em>emphasis</em>");
    });

    it("preserves <u> tags", () => {
      expect(sanitizeRichContent("<u>underline</u>")).toBe("<u>underline</u>");
    });

    it("preserves <del> tags", () => {
      expect(sanitizeRichContent("<del>deleted</del>")).toBe("<del>deleted</del>");
    });

    it("preserves <s> tags", () => {
      expect(sanitizeRichContent("<s>strike</s>")).toBe("<s>strike</s>");
    });

    it("preserves <blockquote> tags", () => {
      expect(sanitizeRichContent("<blockquote>quote</blockquote>")).toBe(
        "<blockquote>quote</blockquote>"
      );
    });

    it("preserves <code> tags", () => {
      expect(sanitizeRichContent("<code>code</code>")).toBe("<code>code</code>");
    });

    it("preserves <br> tags", () => {
      expect(sanitizeRichContent("line1<br>line2")).toContain("<br");
    });

    it("preserves <div> tags", () => {
      expect(sanitizeRichContent("<div>block</div>")).toBe("<div>block</div>");
    });

    it("preserves <p> tags", () => {
      expect(sanitizeRichContent("<p>paragraph</p>")).toBe("<p>paragraph</p>");
    });

    it("preserves <span> tags", () => {
      expect(sanitizeRichContent("<span>inline</span>")).toBe("<span>inline</span>");
    });

    it("preserves <a> with href attribute", () => {
      const input = '<a href="https://example.com">link</a>';
      const result = sanitizeRichContent(input);
      expect(result).toContain("<a");
      expect(result).toContain('href="https://example.com"');
    });

    it("preserves <a> with target attribute", () => {
      const input = '<a href="https://example.com" target="_blank">link</a>';
      const result = sanitizeRichContent(input);
      expect(result).toContain('target="_blank"');
    });

    it("preserves <a> with rel attribute and adds noreferrer", () => {
      const input = '<a href="https://example.com" rel="noopener">link</a>';
      const result = sanitizeRichContent(input);
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it("preserves nested allowed tags", () => {
      const input = "<p><b>bold</b> and <i>italic</i></p>";
      const result = sanitizeRichContent(input);
      expect(result).toContain("<b>bold</b>");
      expect(result).toContain("<i>italic</i>");
    });
  });

  // ─── Blocklisted tags ─────────────────────────────────────────

  describe("blocked tags", () => {
    it("strips <script> tags", () => {
      const result = sanitizeRichContent("<script>alert(1)</script>");
      expect(result).not.toContain("<script");
      expect(result).not.toContain("</script");
    });

    it("strips <iframe> tags", () => {
      const result = sanitizeRichContent('<iframe src="http://evil.com"></iframe>');
      expect(result).not.toContain("<iframe");
    });

    it("strips <img> tags", () => {
      const result = sanitizeRichContent('<img src="http://evil.com/img.jpg">');
      expect(result).not.toContain("<img");
    });

    it("strips <form> tags", () => {
      const result = sanitizeRichContent('<form action="/steal"><input></form>');
      expect(result).not.toContain("<form");
      expect(result).not.toContain("<input");
    });

    it("strips <style> tags", () => {
      const result = sanitizeRichContent("<style>body{display:none}</style>");
      expect(result).not.toContain("<style");
    });

    it("strips <object> tags", () => {
      const result = sanitizeRichContent('<object data="evil.swf"></object>');
      expect(result).not.toContain("<object");
    });

    it("strips <embed> tags", () => {
      const result = sanitizeRichContent('<embed src="evil.swf">');
      expect(result).not.toContain("<embed");
    });
  });

  // ─── Blocked attributes ───────────────────────────────────────

  describe("blocked attributes", () => {
    it("strips onclick from allowed tags", () => {
      const result = sanitizeRichContent('<b onclick="alert(1)">bold</b>');
      expect(result).not.toContain("onclick");
      expect(result).toContain("<b>bold</b>");
    });

    it("strips onerror from allowed tags", () => {
      const result = sanitizeRichContent('<div onerror="alert(1)">div</div>');
      expect(result).not.toContain("onerror");
    });

    it("strips style attribute from allowed tags", () => {
      const result = sanitizeRichContent('<span style="color:red">text</span>');
      expect(result).not.toContain("style=");
    });

    it("strips data-* attributes (ALLOW_DATA_ATTR=false)", () => {
      const result = sanitizeRichContent('<div data-evil="payload">content</div>');
      expect(result).not.toContain("data-evil");
    });

    it("strips class attribute from allowed tags", () => {
      const result = sanitizeRichContent('<p class="injected">text</p>');
      expect(result).not.toContain("class=");
    });

    it("strips id attribute from allowed tags", () => {
      const result = sanitizeRichContent('<div id="injected">content</div>');
      expect(result).not.toContain("id=");
    });
  });

  // ─── XSS via rich content ─────────────────────────────────────

  describe("XSS via rich content", () => {
    it("strips javascript: href from <a> tags", () => {
      const result = sanitizeRichContent('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain("javascript:");
    });

    it("strips data: href from <a> tags", () => {
      const result = sanitizeRichContent(
        '<a href="data:text/html,<script>alert(1)</script>">click</a>'
      );
      expect(result).not.toContain("data:");
    });

    it("handles mixed allowed and disallowed content", () => {
      const input = "<b>safe</b><script>evil</script><i>also safe</i>";
      const result = sanitizeRichContent(input);
      expect(result).toContain("<b>safe</b>");
      expect(result).toContain("<i>also safe</i>");
      expect(result).not.toContain("<script");
    });

    it("handles empty string", () => {
      expect(sanitizeRichContent("")).toBe("");
    });

    it("handles plain text without tags", () => {
      expect(sanitizeRichContent("just text")).toBe("just text");
    });
  });
});
