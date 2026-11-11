import { getSession } from '@/lib/auth';
import { handle, jsonOk } from '@/lib/http';


/** Returns the currently signed-in session user (or null when signed out). */
export const GET = handle(async () => {
  const session = await getSession();
  if (!session) {
    return jsonOk({ success: true, user: null, role: 'visitor' });
  }
  return jsonOk({
    success: true,
    role: session.role,
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      teamId: session.teamId,
    },
  });
});
