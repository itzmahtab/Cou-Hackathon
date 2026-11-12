import { getCtx } from "@/lib/ctx";
import { handle, jsonOk } from "@/lib/http";
import { getPublicLeaderboard } from "@/features/results/service";

export const GET = handle(async () => jsonOk(await getPublicLeaderboard(getCtx())));
