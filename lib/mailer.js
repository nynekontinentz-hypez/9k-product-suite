const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    // Stub: log to console instead of sending
    transporter = {
      sendMail: async (opts) => {
        console.log(`[MAIL STUB] To: ${opts.to} | Subject: ${opts.subject}`);
        return { messageId: 'stub' };
      },
    };
  }
  return transporter;
}

const FROM = process.env.SMTP_FROM || 'support@9ksystems.net';
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000';

module.exports = {
  sendTicketConfirmation: (to, ticket) =>
    getTransporter().sendMail({
      from: FROM, to,
      subject: `[#${ticket.id}] Support ticket received — ${ticket.title}`,
      text: `Hi,\n\nYour support ticket has been received.\n\nTicket: ${ticket.title}\nUrgency: ${ticket.urgency}\nStatus: Open\n\nView your ticket: ${PORTAL_URL}/client/tickets/${ticket.id}\n\n— 9K Systems`,
    }),

  sendTicketUpdate: (to, ticket, summary) =>
    getTransporter().sendMail({
      from: FROM, to,
      subject: `[#${ticket.id}] Update on your ticket — ${ticket.title}`,
      text: `Hi,\n\nYour ticket has been updated.\n\n${summary}\n\nView your ticket: ${PORTAL_URL}/client/tickets/${ticket.id}\n\n— 9K Systems`,
    }),

  sendClientInvite: (to, name, token) =>
    getTransporter().sendMail({
      from: FROM, to,
      subject: `You've been added to the 9K Systems client portal`,
      text: `Hi ${name},\n\n9K Systems has set up your client portal account.\n\nSet your password here (expires in 48 hours):\n${PORTAL_URL}/invite/${token}\n\n— 9K Systems`,
    }),
};
