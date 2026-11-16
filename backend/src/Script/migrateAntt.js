// Aplica backend/sql/antt_module.sql (idempotente). Uso: npm run migrate:antt
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(dir, "../../sql/antt_module.sql");

export async function migrateAntt() {
  const sql = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  const statements = sql.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
  return statements.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrateAntt()
    .then((n) => { console.log(`Módulo ANTT: ${n} comandos aplicados.`); return pool.end(); })
    .catch((e) => { console.error("Falha na migração ANTT:", e.message); process.exit(1); });
}
