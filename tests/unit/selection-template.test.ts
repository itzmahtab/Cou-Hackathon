import { describe, expect, test } from "vitest";
import { DEFAULT_SELECTION_TEMPLATE, DEFAULT_TELEGRAM_LINK, fillTemplate, gmailComposeLink, joinNames, mailtoLink } from "@/features/selection/template";

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
