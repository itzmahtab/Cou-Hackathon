/**
 * Node.js bootstrap: seeds default settings, the first super admin and the
 * private storage buckets. Loaded from `instrumentation.ts` only when the
 * Node.js runtime is active.
 */
export async function register() {
  const { q } = await import('@/lib/db');
  const { randomUUID } = await import('node:crypto');
  const bcrypt = (await import('bcryptjs')).default;
  const { DEFAULT_SETTINGS } = await import('@/lib/defaults');
  const { ensureBuckets } = await import('@/lib/storage');

  try {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await q(
        `INSERT INTO public.settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO NOTHING`,
        [key, JSON.stringify(value)]
      );
    }

    // Seed a super admin ONLY if none exists. Never overwrites an existing password.
    const existing = await q(`SELECT 1 FROM public.staff WHERE role = 'super_admin' LIMIT 1`);
    if (!existing.rowCount) {
      const email = String(process.env.ADMIN_EMAIL || 'admin@cou.ac.bd').trim().toLowerCase();
      const password = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';

      await q(
        `INSERT INTO public.staff (id, name, email, password_hash, must_change_password, role, active)
         VALUES ($1,'Super Admin CoU',$2,$3,true,'super_admin',true)
         ON CONFLICT (email) DO NOTHING`,
        [randomUUID(), email, await bcrypt.hash(password, 12)]
      );

      console.log(
        `Seeded first super admin: ${email} (you will be asked to change the password on first login)`
      );
    }

    await ensureBuckets();
  } catch (e) {
    console.warn('Bootstrap warning:', (e as Error).message);
  }
}
