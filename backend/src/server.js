import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Resend } from "resend";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "200kb" }));

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 204,
  })
);
app.options(/^\/api\/.*$/, cors());

app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

function buildMail({ subject, lines, replyTo }) {
  const to = (process.env.MAIL_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const from = process.env.MAIL_FROM_EMAIL || "onboarding@resend.dev";

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
    from,
    to,
    subject,
    html,
    text,
    replyTo,
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
      name?.trim() ? `Nome: ${name.trim()}` : null,
      email?.trim() ? `Email: ${email.trim()}` : null,
      `Mensagem:\n${message.trim()}`,
    ];

    const mailOptions = buildMail({
      subject: "Sugestões e reclamações (site)",
      lines,
      replyTo: email,
    });

    const { error } = await resend.emails.send(mailOptions);

    if (error) {
      console.error("Resend Error:", error);
      throw new Error(error.message);
    }

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
      `Nome: ${name.trim()}`,
      `Email: ${email.trim()}`,
      company?.trim() ? `Empresa: ${company.trim()}` : null,
      role?.trim() ? `Cargo: ${role.trim()}` : null,
      phone?.trim() ? `Telefone: ${phone.trim()}` : null,
      `Mensagem:\n${message.trim()}`,
    ];

    const mailOptions = buildMail({
      subject: "Contato (site)",
      lines,
      replyTo: email,
    });

    const { error } = await resend.emails.send(mailOptions);

    if (error) {
      console.error("Resend Error:", error);
      throw new Error(error.message);
    }

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
