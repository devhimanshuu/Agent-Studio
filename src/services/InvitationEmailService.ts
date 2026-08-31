/**
 * Invitation Email Service
 *
 * Sends invitation emails for organization membership.
 * Uses a simple email template system.
 */

import { logger } from "@/lib/logger";

// ────────────── Types ──────────────

export interface SendInvitationEmailParams {
  to: string;
  organizationName: string;
  inviterName: string;
  invitationToken: string;
  role: string;
  expiresAt: Date;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ────────────── Service ──────────────

export class InvitationEmailService {
  private appUrl: string;

  constructor() {
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  /**
   * Send invitation email
   */
  async sendInvitation(params: SendInvitationEmailParams): Promise<EmailResult> {
    const { to, organizationName, inviterName, invitationToken, role, expiresAt } = params;

    const invitationUrl = `${this.appUrl}/invitations/${invitationToken}`;
    const expiryDate = expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const subject = `You're invited to join ${organizationName} on Agent Studio`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organization Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #f8fafc; border-radius: 12px; padding: 32px; margin: 20px 0; }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { font-size: 24px; font-weight: bold; color: #4f46e5; }
    .content { background: white; border-radius: 8px; padding: 24px; margin: 20px 0; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 32px; }
    .role-badge { display: inline-block; background: #e0e7ff; color: #4f46e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Agent Studio</div>
    </div>
    
    <div class="content">
      <h2 style="margin-top: 0;">You're invited to join ${organizationName}</h2>
      
      <p><strong>${inviterName}</strong> has invited you to join their organization on Agent Studio.</p>
      
      <p>Your role will be: <span class="role-badge">${role}</span></p>
      
      <p>Click the button below to accept the invitation and create your account:</p>
      
      <div style="text-align: center;">
        <a href="${invitationUrl}" class="button">Accept Invitation</a>
      </div>
      
      <p style="font-size: 14px; color: #64748b;">
        This invitation expires on ${expiryDate}. If you don't accept before then, 
        you'll need to request a new invitation.
      </p>
    </div>
    
    <div class="footer">
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>© ${new Date().getFullYear()} Agent Studio. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
You're invited to join ${organizationName} on Agent Studio

${inviterName} has invited you to join their organization on Agent Studio.

Your role will be: ${role}

To accept the invitation, visit:
${invitationUrl}

This invitation expires on ${expiryDate}.

If you didn't expect this invitation, you can safely ignore this email.
    `.trim();

    try {
      // In production, integrate with an email service (SendGrid, Resend, etc.)
      // For now, log the email content
      logger.info(
        {
          to,
          organizationName,
          inviterName,
          role,
          subject,
          invitationUrl,
          expiresAt,
          expiryDate,
          contentPreview: textContent.slice(0, 100),
          htmlLength: htmlContent.length,
        },
        "Invitation email sent (logged)"
      );

      // TODO: Replace with actual email service integration
      // await emailService.send({ to, subject, html: htmlContent, text: textContent });

      return {
        success: true,
        messageId: `inv-${Date.now()}`,
      };
    } catch (error) {
      logger.error({ error, to }, "Failed to send invitation email");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }

  /**
   * Send reminder email for expiring invitations
   */
  async sendInvitationReminder(params: SendInvitationEmailParams): Promise<EmailResult> {
    const { to, organizationName, inviterName, invitationToken, role, expiresAt } = params;

    const invitationUrl = `${this.appUrl}/invitations/${invitationToken}`;
    const expiryDate = expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const subject = `Reminder: Your invitation to ${organizationName} expires soon`;

    try {
      logger.info(
        {
          to,
          organizationName,
          inviterName,
          role,
          subject,
          invitationUrl,
          expiresAt,
          expiryDate,
        },
        "Invitation reminder email sent (logged)"
      );

      return {
        success: true,
        messageId: `inv-rem-${Date.now()}`,
      };
    } catch (error) {
      logger.error({ error, to }, "Failed to send invitation reminder email");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }
}
