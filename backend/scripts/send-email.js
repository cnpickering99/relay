const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendEmail(to, subject, body) {
  const info = await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    html: body,
  });
  return info.messageId;
}

module.exports = sendEmail;