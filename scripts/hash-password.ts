// Prints an Argon2id hash for the password given on stdin (used by tests and manual recovery).
import { hashPassword } from "../src/lib/auth/password";

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", async () => process.stdout.write(await hashPassword(input.trim())));
