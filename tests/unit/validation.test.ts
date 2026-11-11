import { describe, expect, test } from "vitest";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { ADMIN_ROLES } from "@/lib/db/schema";
import { newRegistrationId, REGISTRATION_ID_PATTERN, safeEqual } from "@/lib/ids";
import { sanitiseName, sniffFile } from "@/lib/r2/files";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { windowState } from "@/lib/time";
import { renderEmail, TEMPLATES } from "@/features/email/templates";
import { normaliseTransactionId, paymentSchema } from "@/features/payments/service";
import { normaliseKey, normalisePhone, normaliseStudentId, registrationSchema } from "@/features/registration/schema";
import { meanScore, reviewSchema, totalScore } from "@/features/reviews/service";
import { deriveStage } from "@/features/status/service";
import { csvCell } from "@/lib/csv";
import { DOCX, EXE, HTML, JPEG, PDF, PLAIN_ZIP, PNG } from "../helpers";

const uuid = () => crypto.randomUUID();
const long = "x".repeat(60);
const person = (i: number) => ({ fullName: `Person ${i}`, email: `P${i}@Example.com `, phone: "01712345678", whatsapp: "01812345678", university: "Comilla  University", studentId: `ID-${i}`, tshirtSize: "M", idCardFileId: uuid() });
const base = (size: number, people = size) => ({
  idempotencyKey: uuid(),
  uploadSession: uuid(),
  team: { name: "  Neural   Nomads ", size },
  participants: Array.from({ length: people }, (_, i) => person(i)),
  idea: { title: "Flood early warning", problemStatement: long, proposedSolution: long, aiComponent: long, expectedImpact: long, documentFileId: uuid() },
  consents: { rules: true, accuracy: true, communications: true },
});

describe("registration schema", () => {
  test.each([1, 2, 3])("accepts a team of %i", (n) => expect(registrationSchema.safeParse(base(n)).success).toBe(true));
  test.each([0, 4])("rejects team size %i", (n) => expect(registrationSchema.safeParse(base(n, Math.max(n, 1))).success).toBe(false));
  test("member count must equal team size", () => {
    const r = registrationSchema.safeParse(base(3, 2));
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.path.join(".") === "team.size")).toBe(true);
  });
  test("normalises team name, email and phone", () => {
    const r = registrationSchema.parse(base(1));
    expect(r.team.name).toBe("Neural Nomads");
    expect(r.participants[0].email).toBe("p0@example.com");
    expect(r.participants[0].phone).toBe("+8801712345678");
    expect(r.participants[0].university).toBe("Comilla University");
  });
  test("every consent must be true", () => {
    for (const key of ["rules", "accuracy", "communications"]) {
      const input = base(1) as never as { consents: Record<string, boolean> };
      input.consents[key] = false;
      expect(registrationSchema.safeParse(input).success).toBe(false);
    }
  });
  test("rejects unknown keys", () => expect(registrationSchema.safeParse({ ...base(1), isAdmin: true }).success).toBe(false));
  test("rejects a short idea text and a bad t-shirt size", () => {
    const a = base(1);
    a.idea.problemStatement = "too short";
    expect(registrationSchema.safeParse(a).success).toBe(false);
    const b = base(1);
    b.participants[0].tshirtSize = "XS";
    expect(registrationSchema.safeParse(b).success).toBe(false);
  });
  test("rejects a missing ID card or idea document", () => {
    const a = base(1) as never as { participants: { idCardFileId?: string }[] };
    delete a.participants[0].idCardFileId;
    expect(registrationSchema.safeParse(a).success).toBe(false);
    const b = base(1) as never as { idea: { documentFileId?: string } };
    delete b.idea.documentFileId;
    expect(registrationSchema.safeParse(b).success).toBe(false);
  });
  test("rejects the same email or student ID twice within a team", () => {
    const a = base(2);
    a.participants[1].email = a.participants[0].email;
    expect(registrationSchema.safeParse(a).success).toBe(false);
    const b = base(2);
    b.participants[1].studentId = "id 0";
    expect(registrationSchema.safeParse(b).success).toBe(false);
  });
});

describe("normalisation", () => {
  test("phones", () => {
    expect(normalisePhone("01712345678")).toBe("+8801712345678");
    expect(normalisePhone("+880 1712-345678")).toBe("+8801712345678");
    expect(normalisePhone("8801712345678")).toBe("+8801712345678");
    for (const bad of ["01212345678", "0171234567", "12345", "017123456789", "abc"]) expect(normalisePhone(bad)).toBeNull();
  });
  test("team names and student IDs collide as intended", () => {
    expect(normaliseKey("Team  A ")).toBe(normaliseKey("team a"));
    expect(normaliseStudentId("CSE-12 034")).toBe(normaliseStudentId("cse12034"));
  });
  test("transaction IDs", () => expect(normaliseTransactionId(" ab12 cd34 ")).toBe("AB12CD34"));
});

describe("file sniffing", () => {
  test("accepts the allowed types by content", () => {
    expect(sniffFile(JPEG)?.ext).toBe("jpg");
    expect(sniffFile(PNG)?.ext).toBe("png");
    expect(sniffFile(new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]))?.ext).toBe("webp");
    expect(sniffFile(PDF)?.ext).toBe("pdf");
    expect(sniffFile(DOCX)?.ext).toBe("docx");
  });
  test("rejects executables, HTML, SVG, plain ZIPs and truncated files", () => {
    for (const bad of [EXE, HTML, PLAIN_ZIP, new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), new Uint8Array([0xff, 0xd8]), new Uint8Array(0)]) {
      expect(sniffFile(bad)).toBeNull();
    }
  });
  test("filenames cannot carry a path", () => {
    expect(sanitiseName("../../etc/passwd")).toBe("passwd");
    expect(sanitiseName("C:\\Users\\x\\id card.jpg")).toBe("id card.jpg");
    expect(sanitiseName("a<b>.png")).toBe("a_b_.png");
  });
});

describe("scoring", () => {
  const full = { scoreRelevance: 20, scoreInnovation: 25, scoreAi: 25, scoreFeasibility: 15, scoreImpact: 15 };
  test("maximum is 100", () => expect(totalScore(full)).toBe(100));
  test.each(Object.entries(full))("%s cannot exceed its maximum or go negative", (key, max) => {
    expect(reviewSchema.safeParse({ ...full, [key]: max + 1 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...full, [key]: -1 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...full, [key]: 1.5 }).success).toBe(false);
  });
  test("mean across reviewers", () => {
    expect(meanScore([])).toBeNull();
    expect(meanScore([80, 91])).toBe(85.5);
    expect(meanScore([70, 71, 71])).toBe(70.67);
  });
});

describe("payment schema", () => {
  const ok = { provider: "BKASH", senderPhone: "01712345678", transactionId: "9ab12cd3ef", amountBdt: 1350 };
  test("accepts and normalises", () => expect(paymentSchema.parse(ok)).toMatchObject({ transactionId: "9AB12CD3EF", senderPhone: "+8801712345678" }));
  test("rejects other providers, bad IDs and bad phones", () => {
    expect(paymentSchema.safeParse({ ...ok, provider: "ROCKET" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...ok, transactionId: "ab" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...ok, transactionId: "DROP TABLE;--" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...ok, senderPhone: "123" }).success).toBe(false);
  });
});

describe("permissions", () => {
  test("super admin can do everything", () => expect(PERMISSIONS.every((p) => can("SUPER_ADMIN", p))).toBe(true));
  test("role boundaries", () => {
    expect(can("REVIEWER", "reviews.write")).toBe(true);
    expect(can("REVIEWER", "registrations.contact")).toBe(false);
    expect(can("REVIEWER", "payments.verify")).toBe(false);
    expect(can("REVIEWER", "shortlist.override")).toBe(false);
    expect(can("PAYMENT_ADMIN", "payments.verify")).toBe(true);
    expect(can("PAYMENT_ADMIN", "reviews.read")).toBe(false);
    expect(can("PAYMENT_ADMIN", "registrations.contact")).toBe(false);
    expect(can("RESULTS_ADMIN", "results.publish")).toBe(true);
    expect(can("RESULTS_ADMIN", "shortlist.manage")).toBe(false);
    expect(can("REGISTRATION_ADMIN", "registrations.export")).toBe(true);
    expect(can("REGISTRATION_ADMIN", "shortlist.finalise")).toBe(false);
    for (const role of ADMIN_ROLES.filter((r) => r !== "SUPER_ADMIN")) {
      for (const p of ["settings.manage", "admins.manage", "logs.read", "shortlist.finalise", "shortlist.override"] as const) expect(can(role, p)).toBe(false);
    }
  });
});

describe("misc", () => {
  test("registration IDs", () => {
    for (let i = 0; i < 200; i++) expect(newRegistrationId()).toMatch(REGISTRATION_ID_PATTERN);
    expect("COU26-ILOU00").not.toMatch(REGISTRATION_ID_PATTERN);
  });
  test("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  test("phase windows are inclusive, in Dhaka time", () => {
    const { phase1OpenAt: o, phase1CloseAt: c } = DEFAULT_SETTINGS;
    expect(windowState(Date.parse("2026-11-11T23:59:59+06:00"), o, c)).toBe("before");
    expect(windowState(Date.parse("2026-11-12T00:00:00+06:00"), o, c)).toBe("open");
    expect(windowState(Date.parse("2026-11-18T23:59:59+06:00"), o, c)).toBe("open");
    expect(windowState(Date.parse("2026-11-19T00:00:00+06:00"), o, c)).toBe("closed");
  });
  test("participant-facing stage", () => {
    expect(deriveStage("SHORTLISTED", null)).toBe("PAYMENT_PENDING");
    expect(deriveStage("SHORTLISTED", "REJECTED")).toBe("PAYMENT_PENDING");
    expect(deriveStage("SHORTLISTED", "PENDING_VERIFICATION")).toBe("PAYMENT_VERIFICATION");
    expect(deriveStage("CONFIRMED", "VERIFIED")).toBe("CONFIRMED");
    expect(deriveStage("NOT_SELECTED", null)).toBe("NOT_SELECTED");
  });
  test("every email template renders subject, html and text, and escapes input", () => {
    const evil = `<script>alert("x")</script>`;
    const payload = { name: evil, teamName: evil, registrationId: "COU26-ABC123", members: [evil], ideaTitle: evil, subject: "Hello", body: `One\n\n${evil}`, reason: evil, code: "123456", statusUrl: "https://hack.test/status?p=1&s=2", leaderboardUrl: "https://hack.test/leaderboard", url: "https://hack.test/admin", feeBdt: 1350 };
    for (const name of Object.keys(TEMPLATES)) {
      const out = renderEmail(name, payload);
      expect(out.subject.length).toBeGreaterThan(3);
      expect(out.text.length).toBeGreaterThan(20);
      expect(out.html).toContain("<!doctype html>");
      expect(out.html).not.toContain("<script>");
    }
  });
  test("CSV cells are quoted and formula-proofed", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+8801712345678")).toBe(`"'+8801712345678"`);
    expect(csvCell(null)).toBe('""');
  });
});
