import { describe, expect, test } from "vitest";
import { DEFAULT_SELECTION_TEMPLATE, DEFAULT_TELEGRAM_LINK, fillTemplate, gmailComposeLink, joinNames, mailtoLink, renderSelectionEmail, safeUrl } from "@/features/selection/template";

describe("selection email template", () => {
  test("fills known placeholders and leaves unknown ones visible", () => {
    expect(fillTemplate("Hi {teamName} ({registrationId}) {oops}", { teamName: "Twin logic", registrationId: "COU26-2572E1" })).toBe("Hi Twin logic (COU26-2572E1) {oops}");
    expect(fillTemplate("{teamName}{teamName}", { teamName: "A" })).toBe("AA");
  });

  test("the default template uses the Telegram group link", () => {
    expect(DEFAULT_SELECTION_TEMPLATE.telegramLink).toBe(DEFAULT_TELEGRAM_LINK);
    expect(DEFAULT_TELEGRAM_LINK).toBe("https://t.me/+i1nLFtZoiLkzYThl");
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

describe("formatted selection email (TECHNOVA design)", () => {
  const vars = { teamName: "Twin <logic> & co", registrationId: "COU26-2572E1", memberNames: "A and B" };

  test("default design: header, headline, team card with every member, Telegram button, website, helpline, footer", () => {
    const m = renderSelectionEmail(DEFAULT_SELECTION_TEMPLATE, vars, { members: ["Md Yak Safu", "Munny Rahaman Dristy"] });
    expect(m.subject).toBe("Congratulations! You are selected | CoU TECHNOVA 2026");
    expect(m.fragment).toContain("CoU TECHNOVA 2026");
    expect(m.fragment).toContain("CONGRATULATIONS!");
    expect(m.fragment).toContain("YOUR TEAM IS IN THE TOP 40 · AI HACKATHON");
    expect(m.fragment).toContain('<b style="color:#ffa530">selected for the Final Round</b>');
    expect(m.fragment).toContain("Twin &lt;logic&gt; &amp; co"); // team data is escaped
    expect(m.fragment).toContain("1. Md Yak Safu<br>2. Munny Rahaman Dristy");
    expect(m.fragment).not.toContain("3. ");
    expect(m.fragment).toMatch(/<a href="https:\/\/t\.me\/\+i1nLFtZoiLkzYThl"[^>]*>✈️ JOIN TELEGRAM GROUP<\/a>/);
    expect(m.fragment).toContain('href="https://coutechnova.xyz"');
    expect(m.fragment).toContain(">coutechnova.xyz<");
    expect(m.fragment).toContain('href="mailto:coutechnova2026@gmail.com"');
    expect(m.fragment).toContain("INNOVATE. <span");
    expect(m.fragment).not.toMatch(/\{\w+\}|\{\{/);
    expect(m.html.startsWith("<!doctype html>")).toBe(true);
    expect(m.text).toContain("TEAM MEMBERS:\n1. Md Yak Safu\n2. Munny Rahaman Dristy");
    expect(m.text).toContain("✈️ JOIN TELEGRAM GROUP: https://t.me/+i1nLFtZoiLkzYThl");
    expect(m.text).not.toContain("**");
  });

  test("typed markup is shown as text, unsafe links are dropped, empty sections disappear", () => {
    const tpl = { ...DEFAULT_SELECTION_TEMPLATE, body: "<script>alert(1)</script>\n[bad](javascript:alert(1)) and [ok](https://example.com)\n- **one**\n- two", helplineEmail: "", subheadline: "" };
    const m = renderSelectionEmail(tpl, vars, { members: [] });
    expect(m.fragment).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(m.fragment).not.toContain("<script>");
    expect(m.fragment).not.toContain("javascript:");
    expect(m.fragment).toContain('href="https://example.com"');
    expect(m.fragment).toMatch(/<ul [^>]*><li[^>]*><b [^>]*>one<\/b><\/li><li[^>]*>two<\/li><\/ul>/);
    expect(m.fragment).not.toContain("Need help?");
    expect(m.fragment).not.toContain("TEAM MEMBERS");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("https://t.me/+x")).toBe("https://t.me/+x");
  });

  test("team values containing formatting characters are not interpreted", () => {
    const m = renderSelectionEmail({ ...DEFAULT_SELECTION_TEMPLATE, body: "Team {teamName}" }, { teamName: "**x** [y](https://evil.test)" }, { members: ["<b>z</b>"] });
    expect(m.fragment).toContain("Team **x** [y](https://evil.test)");
    expect(m.fragment).not.toContain('href="https://evil.test"');
    expect(m.fragment).toContain("1. &lt;b&gt;z&lt;/b&gt;");
  });
});

describe("Purple banner design (classic)", () => {
  const classic = { ...DEFAULT_SELECTION_TEMPLATE, design: "classic" as const };
  const vars = { teamName: "Twin <logic>", registrationId: "COU26-2572E1", memberNames: "A and B", eventDate: "24 November 2026", venue: "Comilla University", feeBdt: "1345", paymentDeadline: "22 Nov 2026, 23:59", ideaTitle: "PoraBondhu" };

  test("banner, Click-here Telegram link, three buttons, facts box and helpline footer", () => {
    const m = renderSelectionEmail(classic, vars, { assetBase: "https://coutechnova.xyz/", members: ["A", "B"] });
    expect(m.subject).toBe("Congratulations Twin <logic>! You are selected for the CoU AI Hackathon 2026 final");
    expect(m.fragment).toContain('src="https://coutechnova.xyz/email/header.jpg"');
    expect(m.fragment).toMatch(/<a href="https:\/\/t\.me\/\+i1nLFtZoiLkzYThl"[^>]*>Click here<\/a>/);
    for (const label of [">Join Telegram channel<", ">Read the rulebook<", ">Visit website<"]) expect(m.fragment).toContain(label);
    expect(m.fragment).toContain(">Registration ID<");
    expect(m.fragment).toContain("mailto:coutechnova2026@gmail.com");
    expect(m.fragment).toContain("Twin &lt;logic&gt;");
    expect(m.fragment).not.toContain("TECHNOVA 2026</div>"); // not the orange design
    expect(m.text).toContain("Click here (https://t.me/+i1nLFtZoiLkzYThl)");
  });

  test("the design field switches the output; unsafe input stays inert", () => {
    expect(renderSelectionEmail(DEFAULT_SELECTION_TEMPLATE, vars).fragment).toContain("JOIN TELEGRAM GROUP");
    const m = renderSelectionEmail({ ...classic, classicBody: "<img src=x onerror=alert(1)> [x](javascript:alert(1))" }, vars, { assetBase: "https://a.test" });
    expect(m.fragment).not.toContain("<img src=x");
    expect(m.fragment).not.toContain("javascript:");
  });
});
