import type { Metadata } from "next";
import Link from "next/link";
import { PrizeCards } from "@/components/sections/home";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Prizes", description: "BDT 25,000 in prizes: Champion BDT 10,000, First Runner-up BDT 8,000, Second Runner-up BDT 7,000.", alternates: { canonical: "/prizes" } };

export default function PrizesPage() {
  return (
    <>
      <PageHeader eyebrow="Prizes" title={<>BDT 25,000 <span className="text-gradient">prize pool</span></>} lead="Three teams take home prize money. Winners are decided by the judging panel on hackathon day and published on the leaderboard." />
      <div className="container-page py-20 md:py-28">
        <PrizeCards />
        <div className="prose-page mx-auto mt-20">
          <h2>How winners are chosen</h2>
          <p>Each confirmed team presents its project to the judges at the end of the five-hour on-site final. Judges score the working solution, the use of AI, the quality of execution and the presentation.</p>
          <p>Prize money is awarded per team, not per member. Results are announced at the award ceremony and then published on the <Link href="/leaderboard">leaderboard</Link>.</p>
        </div>
      </div>
    </>
  );
}
