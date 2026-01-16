import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "200kb" }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? "*",
  })
);

app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function zodErrorToMessage(error) {
  const first = error.issues?.[0];
  if (!first) return "Dados inválidos.";

  const field = first.path?.[0];

  if (field === "message" && first.code === "too_small") {
    return "Mensagem muito curta. Mínimo de 5 caracteres.";
  }
  if (first.code === "invalid_type") {
    return "Campo obrigatório.";
  }
  if (field === "email" && first.code === "invalid_string") {
    return "E-mail inválido.";
  }

  return "Verifique os campos e tente novamente.";
}

const feedbackSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(4000),
});

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(4000),
});

function buildMail({ subject, lines }) {
  const to = (process.env.MAIL_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const fromName = process.env.MAIL_FROM_NAME || "Site";
  const fromEmail = process.env.SMTP_USER;

  const text = lines.filter(Boolean).join("\n\n");

  const safe = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #111;">
      ${lines
        .filter(Boolean)
        .map(
          (line) =>
            `<div style="margin: 0 0 12px 0; white-space: pre-wrap;">${safe(
              line
            )}</div>`
        )
        .join("")}
    </div>
  `;

  return {
    to,
    from: `"${fromName}" <${fromEmail}>`,
    subject,
    text,
    html,
  };
}

app.get("/health", (_, res) => res.json({ ok: true }));


app.post("/api/feedback", async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: zodErrorToMessage(parsed.error),
    });
  }

  const { name, email, message } = parsed.data;

  try {
    const lines = [
      name?.trim() ? name.trim() : null,
      email?.trim() ? email.trim() : null,
      message.trim(),
    ];

    const mail = buildMail({
      subject: "Sugestões e reclamações (site)",
      lines,
    });

    if (email) mail.replyTo = email;

    await transporter.sendMail(mail);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      message: "Não foi possível enviar o e-mail, tente novamente.",
    });
  }
});

app.post("/api/contact", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: zodErrorToMessage(parsed.error),
    });
  }

  const { name, email, company, role, phone, message } = parsed.data;

  try {
    const lines = [
      name.trim(),
      email.trim(),
      company?.trim() ? company.trim() : null,
      role?.trim() ? role.trim() : null,
      phone?.trim() ? phone.trim() : null,
      message.trim(),
    ];

    const mail = buildMail({
      subject: "Contato (site)",
      lines,
    });

    mail.replyTo = email;

    await transporter.sendMail(mail);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      message: "Não foi possível enviar o e-mail, tente novamente.",
    });
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API rodando em http://localhost:${port}`));
