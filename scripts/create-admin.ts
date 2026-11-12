/**
 * Creates an admin account. There is no public sign-up and no default password.
 *
 *   pnpm admin:create -- --local     # local development database
 *   pnpm admin:create -- --remote    # production D1 (needs CLOUDFLARE_API_TOKEN)
 *
 * The password is read without echo, hashed here with Argon2id, and only the
 * hash is sent to the database.
 */
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { hashPassword, passwordProblem } from "../src/lib/auth/password";
import { ADMIN_ROLES } from "../src/lib/constants";

const target = process.argv.includes("--remote") ? "--remote" : "--local";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => write(s.startsWith(question) ? s : "");
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const sql = (v: string) => `'${v.replace(/'/g, "''")}'`;

async function main() {
  const email = (await ask("Email: ")).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That is not a valid email.");
  const name = await ask("Display name: ");
  const roleAnswer = (await ask(`Role [${ADMIN_ROLES.join(", ")}] (default SUPER_ADMIN): `)) || "SUPER_ADMIN";
  if (!(ADMIN_ROLES as readonly string[]).includes(roleAnswer)) throw new Error("Unknown role.");
  const password = await ask("Password (min 12 characters): ", true);
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  if ((await ask("Repeat password: ", true)) !== password) throw new Error("Passwords do not match.");

  const now = Date.now();
  const statement = `INSERT INTO admins (id, email, name, password_hash, role, is_active, must_change_password, created_at, updated_at) VALUES (${sql(crypto.randomUUID())}, ${sql(email)}, ${sql(name || email)}, ${sql(hashPassword(password))}, ${sql(roleAnswer)}, 1, 0, ${now}, ${now});`;
  execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "cou-hackathon", target, "--command", statement], { stdio: ["ignore", "inherit", "inherit"] });
  console.log(`\nCreated ${roleAnswer} ${email} in the ${target.slice(2)} database. Sign in at /admin/login.`);
}

main().catch((err) => {
  console.error(`\n${(err as Error).message}`);
  process.exit(1);
});
