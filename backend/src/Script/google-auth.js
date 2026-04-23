import readline from "readline";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);
console.log("CLIENT SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "OK" : "NÃO CARREGOU");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost"
);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\nAbra este link:\n");
console.log(authUrl);

rl.question("\nCole o código aqui: ", async (code) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code);

    console.log("\nSEU REFRESH TOKEN:");
    console.log(tokens.refresh_token);
  } catch (error) {
    console.error("Erro ao gerar token:", error.message);
  } finally {
    rl.close();
  }
});