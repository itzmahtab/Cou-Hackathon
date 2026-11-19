import { describe, expect, test } from "vitest";
import { DEFAULT_SELECTION_TEMPLATE, DEFAULT_TELEGRAM_LINK, fillTemplate, gmailComposeLink, joinNames, mailtoLink, renderSelectionEmail, safeUrl } from "@/features/selection/template";

describe("selection email template", () => {
  test("fills known placeholders and leaves unknown ones visible", () => {
    expect(fillTemplate("Hi {teamName} ({registrationId}) {oops}", { teamName: "Twin logic", registrationId: "COU26-2572E1" })).toBe("Hi Twin logic (COU26-2572E1) {oops}");
    expect(fillTemplate("{teamName}{teamName}", { teamName: "A" })).toBe("AA");
  });

  test("the default template carries the Telegram link through {telegramLink}", () => {
    expect(DEFAULT_SELECTION_TEMPLATE.telegramLink).toBe("https://t.me/+i1nLFtZoiLkzYThl");
    const body = fillTemplate(DEFAULT_SELECTION_TEMPLATE.body, { telegramLink: DEFAULT_TELEGRAM_LINK, teamName: "X" });
    expect(body).toContain("https://t.me/+i1nLFtZoiLkzYThl");
    expect(body).not.toContain("{telegramLink}");
  });

  test("joins names naturally", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });

  test("mailto and Gmail links address every member and round-trip the text", () => {
    const to = ["a.b+x@gmail.com", "c@uni.edu.bd"];
    const subject = "Congratulations & welcome?";
    const body = "Line 1\nবাংলা line 2\nhttps://t.me/+i1nLFtZoiLkzYThl";
    const m = mailtoLink(to, subject, body);
    expect(m.startsWith("mailto:a.b%2Bx@gmail.com,c@uni.edu.bd?")).toBe(true);
    const params = new URLSearchParams(m.split("?")[1]);
    expect(params.get("subject")).toBe(subject);
    expect(params.get("body")).toBe(body.replace(/\n/g, "\r\n"));

    const g = new URL(gmailComposeLink(to, subject, body));
    expect(g.searchParams.get("to")).toBe(to.join(","));
    expect(g.searchParams.get("su")).toBe(subject);
    expect(g.searchParams.get("body")).toBe(body);
  });
});

describe("formatted selection email", () => {
  const vars = { teamName: "Twin <logic> & co", registrationId: "COU26-2572E1", memberNames: "A and B", eventDate: "24 November 2026", venue: "Comilla University", feeBdt: "1345", paymentDeadline: "22 Nov 2026, 23:59", ideaTitle: "PoraBondhu" };
  const opts = { assetBase: "https://coutechnova.xyz/", contactEmail: "team@coutechnova.xyz" };

  test("default template: banner, Telegram 'click here' hyperlink, buttons, facts and footer", () => {
    const m = renderSelectionEmail(DEFAULT_SELECTION_TEMPLATE, vars, opts);
    expect(m.subject).toBe("Congratulations Twin <logic> & co! You are selected for the CoU AI Hackathon 2026 final");
    expect(m.fragment).toContain('src="https://coutechnova.xyz/email/header.jpg"');
    expect(m.fragment).toMatch(/<a href="https:\/\/t\.me\/\+i1nLFtZoiLkzYThl"[^>]*>Click here<\/a>/);
    expect(m.fragment).toContain('href="https://coutechnova.xyz/rulebook.pdf"');
    expect(m.fragment).toContain(">Join Telegram channel<");
    expect(m.fragment).toContain("Twin &lt;logic&gt; &amp; co"); // team data is escaped
    expect(m.fragment).toContain("mailto:team@coutechnova.xyz");
    expect(m.fragment).toContain("<ol ");
    expect(m.fragment).not.toContain("{");
    expect(m.html.startsWith("<!doctype html>")).toBe(true);
    expect(m.text).toContain("Click here (https://t.me/+i1nLFtZoiLkzYThl)");
    expect(m.text).not.toContain("**");
  });

  test("typed markup is shown as text and unsafe links are dropped", () => {
    const tpl = { ...DEFAULT_SELECTION_TEMPLATE, body: "<script>alert(1)</script>\n[bad](javascript:alert(1)) and [ok](https://example.com)\n- **one**\n- two" };
    const m = renderSelectionEmail(tpl, vars, opts);
    expect(m.fragment).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(m.fragment).not.toContain("<script>");
    expect(m.fragment).not.toContain("javascript:");
    expect(m.fragment).toContain('href="https://example.com"');
    expect(m.fragment).toMatch(/<ul [^>]*><li[^>]*><strong>one<\/strong><\/li><li[^>]*>two<\/li><\/ul>/);
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("https://t.me/+x")).toBe("https://t.me/+x");
  });

  test("team values containing formatting characters are not interpreted", () => {
    const m = renderSelectionEmail({ ...DEFAULT_SELECTION_TEMPLATE, body: "Team {teamName}" }, { teamName: "**x** [y](https://evil.test)" }, opts);
    expect(m.fragment).toContain("Team **x** [y](https://evil.test)");
    expect(m.fragment).not.toContain('href="https://evil.test"');
  });
});
