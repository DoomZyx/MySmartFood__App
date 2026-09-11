import nodemailer from "nodemailer";
import logger from "../Services/logging/logger.js";

function transporter() {
  if (!process.env.EMAIL_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === "465",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDemoEmails(demo) {
  const mailer = transporter();
  if (!mailer) {
    logger.warn("SMTP non configuré, e-mails démo ignorés");
    return;
  }
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  await mailer.sendMail({
    from,
    to: demo.email,
    subject: "Nous avons bien reçu votre demande de démo",
    text: `Bonjour ${demo.name},\n\nNous avons bien reçu votre demande de démonstration.\n`,
  });
  await mailer.sendMail({
    from,
    to: process.env.EMAIL_TEAM || from,
    subject: `Nouvelle demande de démo : ${demo.company}`,
    text: `${demo.name} <${demo.email}>\n${demo.company}\n${demo.teamSize}\n${demo.preferredTime} / ${demo.duration}\n\n${demo.needs}`,
  });
}

export async function sendDashboardAccessEmail({ email, name, accessUrl }) {
  if (!email || !accessUrl) return;
  const mailer = transporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const greeting = name ? `Bonjour ${name}` : "Bonjour";
  const text = `${greeting},\n\nVotre abonnement est actif. Ouvrez ce lien pour accéder à votre tableau de bord :\n${accessUrl}\n\nCe lien expire dans 7 jours et ne peut être utilisé qu'une fois.\n`;

  if (!mailer) {
    if (process.env.APP_ENV !== "prod") {
      logger.warn({ to: email }, "SMTP absent : e-mail d'accès non envoyé");
      logger.info({ accessUrl }, "Lien d'accès dashboard (hors production uniquement)");
    } else {
      logger.warn("SMTP non configuré, e-mail d'accès dashboard ignoré");
    }
    return;
  }

  await mailer.sendMail({
    from,
    to: email,
    subject: "Votre accès MySmartFood",
    text,
    html: `<p>${escapeHtml(greeting)},</p><p>Votre abonnement est actif.</p><p><a href="${escapeHtml(accessUrl)}">Accéder à mon tableau de bord</a></p><p>Ce lien expire dans 7 jours et ne peut être utilisé qu'une fois.</p>`,
  });
}

export async function sendContactEmails(contact) {
  const mailer = transporter();
  if (!mailer) {
    logger.warn("SMTP non configuré, e-mails contact ignorés");
    return;
  }
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  await mailer.sendMail({
    from,
    to: contact.email,
    subject: "Nous avons bien reçu votre message",
    text: `Bonjour ${contact.name},\n\nNous avons bien reçu votre message.\n\nSujet : ${contact.subject}\n`,
  });
  await mailer.sendMail({
    from,
    to: from,
    subject: `Nouveau contact : ${contact.subject}`,
    text: `${contact.name} <${contact.email}>\n${contact.company || ""}\n\n${contact.message}`,
    html: `<p>${escapeHtml(contact.name)} &lt;${escapeHtml(contact.email)}&gt;</p><p>${escapeHtml(contact.message)}</p>`,
  });
}
