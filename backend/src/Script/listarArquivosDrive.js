import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Seu .env fica em backend/.env
const envPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: envPath });

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_DRIVE_FOLDER_ID,
} = process.env;

const faltando = [];

if (!GOOGLE_CLIENT_ID) faltando.push("GOOGLE_CLIENT_ID");
if (!GOOGLE_CLIENT_SECRET) faltando.push("GOOGLE_CLIENT_SECRET");
if (!GOOGLE_REFRESH_TOKEN) faltando.push("GOOGLE_REFRESH_TOKEN");
if (!GOOGLE_DRIVE_FOLDER_ID) faltando.push("GOOGLE_DRIVE_FOLDER_ID");

if (faltando.length > 0) {
  console.error("❌ Variáveis faltando no .env:");
  console.error(faltando.join(", "));
  console.error("\n📄 Caminho usado para o .env:", envPath);
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "http://localhost"
);

oAuth2Client.setCredentials({
  refresh_token: GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client,
});

function escaparSql(valor) {
  return String(valor || "").replace(/'/g, "''");
}

async function listarArquivosDrive() {
  const arquivos = [];
  let pageToken = null;

  do {
    const response = await drive.files.list({
      q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 1000,
      pageToken,
    });

    const files = response.data.files || [];

    for (const file of files) {
      arquivos.push({
        file_name: file.name,
        drive_file_id: file.id,
        mime_type: file.mimeType || "application/pdf",
      });
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return arquivos;
}

async function main() {
  console.log("🔎 Buscando PDFs no Google Drive...");
  console.log("📄 .env carregado de:", envPath);
  console.log("📁 Pasta do Drive:", GOOGLE_DRIVE_FOLDER_ID);

  console.log("🔐 GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID ? "OK" : "FALTANDO");
  console.log("🔐 GOOGLE_CLIENT_SECRET:", GOOGLE_CLIENT_SECRET ? "OK" : "FALTANDO");
  console.log("🔐 GOOGLE_REFRESH_TOKEN:", GOOGLE_REFRESH_TOKEN ? "OK" : "FALTANDO");

  const arquivos = await listarArquivosDrive();

  console.log(`📄 Arquivos encontrados: ${arquivos.length}`);

  const outputDir = path.resolve(__dirname, "../../exports");
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "drive_files.json");
  const sqlPath = path.join(outputDir, "drive_files_temp.sql");

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(arquivos, null, 2),
    "utf-8"
  );

  const valuesSql = arquivos
    .map((arquivo) => {
      return `('${escaparSql(arquivo.file_name)}', '${escaparSql(arquivo.drive_file_id)}', '${escaparSql(arquivo.mime_type)}')`;
    })
    .join(",\n");

  const sql = `
CREATE TEMPORARY TABLE drive_files_temp (
    file_name VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf'
);

INSERT INTO drive_files_temp (file_name, drive_file_id, mime_type)
VALUES
${valuesSql};
`.trim();

  fs.writeFileSync(sqlPath, sql, "utf-8");

  console.log(`✅ JSON gerado em: ${jsonPath}`);
  console.log(`✅ SQL temporário gerado em: ${sqlPath}`);

  console.log("\nPrévia dos primeiros arquivos:");
  console.table(arquivos.slice(0, 10));
}

main().catch((error) => {
  console.error("❌ Erro ao listar arquivos:", error);
  process.exit(1);
});