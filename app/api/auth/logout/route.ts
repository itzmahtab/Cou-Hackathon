import { clearSessionCookie } from '@/lib/auth';
import { handle, jsonOk } from '@/lib/http';


export const POST = handle(async () => {
  await clearSessionCookie();
  return jsonOk({ success: true });
});
