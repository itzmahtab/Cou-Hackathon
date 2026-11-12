import { Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Podium } from "@/components/sections/podium";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicLeaderboard } from "@/features/results/service";
import { getCtx } from "@/lib/ctx";
import { formatDhaka } from "@/lib/time";

export const metadata: Metadata = { title: "Leaderboard", description: "Final results of CoU AI Hackathon 2026.", alternates: { canonical: "/leaderboard" } };

export default async function LeaderboardPage() {
  const board = await getPublicLeaderboard(getCtx());
  if (!board.published) {
    return (
      <>
        <PageHeader eyebrow="Leaderboard" title="Results pending" lead="The final leaderboard is published after the award ceremony on hackathon day." />
        <div className="container-page py-20 text-center">
          <Hourglass size={40} className="mx-auto text-primary-soft" aria-hidden />
          <p className="mt-5 text-muted">Check back after 24 November 2026.</p>
          <Link href="/prizes" className="btn btn-secondary mt-8">
            See the prizes
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader eyebrow="Leaderboard" title={<>And the winners <span className="text-gradient">are…</span></>} lead={`Final results, published ${formatDhaka(board.publishedAt)}.`} />
      <div className="container-page py-16 md:py-24">
        <Podium rows={board.rows} />
        <div className="table-wrap mt-16">
          <table className="table">
            <caption className="sr-only">Final standings</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Team</th>
                <th scope="col">University</th>
                <th scope="col">Project</th>
                <th scope="col" className="text-right">
                  Score
                </th>
                <th scope="col" className="text-right">
                  Prize
                </th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((r) => (
                <tr key={`${r.rank}-${r.teamName}`}>
                  <td className="font-mono">{r.rank ?? "—"}</td>
                  <td className="font-semibold">{r.teamName}</td>
                  <td className="text-muted">{r.universities.join(", ")}</td>
                  <td className="text-muted">{r.projectTitle}</td>
                  <td className="text-right font-mono">{r.totalScore}</td>
                  <td className="text-right font-mono">{r.prizeBdt ? `BDT ${r.prizeBdt.toLocaleString("en-US")}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
