import { getSettings } from '@/lib/data';
import { handle, jsonOk } from '@/lib/http';


export const GET = handle(async () => {
  const settings = await getSettings();
  return jsonOk({ ok: true, success: true, settings, data: [settings] });
});
