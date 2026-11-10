import nodemailer from 'nodemailer'
import { config } from '../config.js'

const transport = config.smtp
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    })
  : null

/** Signup needs a way to deliver the confirmation link. */
export const canSendMail = (): boolean => !!transport || !config.isProduction

export async function sendConfirmationEmail(to: string, link: string): Promise<void> {
  if (!transport) {
    // Development without SMTP: print the link instead.
    console.log(`[mail] confirmation link for ${to}: ${link}`)
    return
  }
  await transport.sendMail({
    from: config.smtp!.from,
    to,
    subject: 'Confirm your GP Connect Demonstrator account',
    text:
      'Confirm your email address to finish creating your account:\n\n' +
      `${link}\n\n` +
      'The link expires in 24 hours. If you did not sign up, ignore this email.',
  })
}
