/**
 * Final leaderboard of CoU AI Hackathon 2026, from the combined marking sheet
 * (Part 1 + Part 2 + Part 3, out of 100). Only rank, team name and total are
 * published; the per-criterion and per-judge marks stay private.
 * Teams with equal totals share a rank, except the 84-point tie at the top,
 * which the organizers decided in DU_Synapse's favour.
 */
export interface LeaderboardEntry {
  rank: number;
  team: string;
  total: number;
}

export const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, team: "DU_Synapse", total: 84 },
  { rank: 2, team: "Apel", total: 84 },
  { rank: 3, team: "Rewoo", total: 81 },
  { rank: 4, team: "CoU_The_Final_Run", total: 80 },
  { rank: 5, team: "3zeros", total: 78 },
  { rank: 6, team: "DualStack", total: 77.5 },
  { rank: 7, team: "Agentic Bekar", total: 77 },
  { rank: 8, team: "Three Dimensions", total: 76.5 },
  { rank: 9, team: "Kemon Dilam Bondhura", total: 76 },
  { rank: 9, team: "MIST_Strelitzia", total: 76 },
  { rank: 9, team: "solostack", total: 76 },
  { rank: 9, team: "Titans", total: 76 },
  { rank: 13, team: "EU_SHADOW", total: 75 },
  { rank: 13, team: "JU_Segfault", total: 75 },
  { rank: 15, team: "Team_absent", total: 74.5 },
  { rank: 16, team: "CoU_Outthinkers", total: 74 },
  { rank: 16, team: "NSTU_Proloy", total: 74 },
  { rank: 16, team: "YorHa", total: 74 },
  { rank: 19, team: "Last_Minute_Submission", total: 73.5 },
  { rank: 19, team: "Team Night owl", total: 73.5 },
  { rank: 21, team: "MIST_Dreamers", total: 73 },
  { rank: 21, team: "QUINTESSENCE MINUS INFINITY", total: 73 },
  { rank: 21, team: "Sec_Signers", total: 73 },
  { rank: 21, team: "Team TimeStamp", total: 73 },
  { rank: 21, team: "Titanz", total: 73 },
  { rank: 26, team: "Twin logic", total: 72.5 },
  { rank: 27, team: "Mig_Guard", total: 72 },
  { rank: 27, team: "Necropolis", total: 72 },
  { rank: 29, team: "Mandarin", total: 71 },
  { rank: 29, team: "Phantom Troupe", total: 71 },
  { rank: 31, team: "Nexora", total: 70 },
  { rank: 31, team: "NSTU Winterfell", total: 70 },
  { rank: 31, team: "Zero-Shot", total: 70 },
  { rank: 34, team: "BABY_DEV.EXE – PCIU", total: 69 },
  { rank: 35, team: "Bro_Code", total: 68.5 },
  { rank: 36, team: "404 solver", total: 68 },
  { rank: 36, team: "Prompt_Pirates", total: 68 },
  { rank: 38, team: "Hello Void", total: 67 },
  { rank: 38, team: "Yuki_no_Hana", total: 67 },
  { rank: 40, team: "IIUC_ZeroCode", total: 66 },
  { rank: 40, team: "Tesseract", total: 66 },
  { rank: 42, team: "NeuroForge", total: 65 },
  { rank: 43, team: "Zero_Bugs_Zone", total: 61 },
  { rank: 44, team: "Neural Ninjas", total: 56 },
  { rank: 45, team: "Cuet_Al_Masaar", total: 52 },
];
