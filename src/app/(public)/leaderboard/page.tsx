import type { Metadata } from "next";
import { LEADERBOARD } from "@/config/leaderboard";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Leaderboard", description: "Final results of CoU AI Hackathon 2026.", alternates: { canonical: "/leaderboard" } };

const RANK_COLOR: Record<number, string> = { 1: "text-gold", 2: "text-silver", 3: "text-bronze" };

export default function LeaderboardPage() {
  return (
    <>
      <PageHeader eyebrow="Leaderboard" title={<>Final <span className="text-gradient">standings</span></>} lead="Final results of CoU AI Hackathon 2026. Total marks are out of 100." />
      <div className="container-page py-16 md:py-24">
        <div className="table-wrap">
          <table className="table min-w-0">
            <caption className="sr-only">Final standings</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Team</th>
                <th scope="col" className="text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {LEADERBOARD.map((r) => (
                <tr key={r.team}>
                  <td className={cn("font-mono font-semibold", RANK_COLOR[r.rank])}>{r.rank}</td>
                  <td className="font-semibold">{r.team}</td>
                  <td className="text-right font-mono">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
