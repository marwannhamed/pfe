require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const t = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD },
  });
  const info = await t.sendMail({
    from: '"LeaseManager" <noreply@leasemanager.com>',
    to: 'hamed.marwen@esprit.tn',
    subject: 'Mailtrap test from LeaseManager',
    html: '<p>If you see this in Mailtrap, SMTP works.</p>',
  });
  console.log('mailtrap test sent', info.messageId);
}

main().catch((e) => {
  console.error('mailtrap failed', e.message);
  process.exit(1);
});
