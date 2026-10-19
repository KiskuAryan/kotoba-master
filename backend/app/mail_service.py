import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Optional, List, Dict
from app.config import settings

logger = logging.getLogger("kotoba_master.email")

# In-memory storage for development / testing mail inspection
dev_mailbox: List[Dict] = []
MAX_DEV_MAILBOX_SIZE = 50


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    email_type: str = "general",
    token: Optional[str] = None
) -> bool:
    """
    Sends an email using configured SMTP settings.
    Falls back gracefully to the in-memory dev mailbox if SMTP is not configured or unavailable.
    """
    email_record = {
        "to": to_email,
        "subject": subject,
        "type": email_type,
        "token": token,
        "html": html_body,
        "text": text_body,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "delivered_via_smtp": False
    }

    # Store in dev mailbox for inspection in dev mode & automated tests
    dev_mailbox.append(email_record)
    if len(dev_mailbox) > MAX_DEV_MAILBOX_SIZE:
        dev_mailbox.pop(0)

    # If SMTP is configured, attempt actual live delivery
    if settings.SMTP_HOST:
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = settings.EMAILS_FROM
            msg["To"] = to_email
            msg.set_content(text_body)
            msg.add_alternative(html_body, subtype="html")

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            email_record["delivered_via_smtp"] = True
            logger.info(f"Email sent via SMTP to {to_email}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP to {to_email}: {e}")
            # Do not re-raise; delivery recorded in dev mailbox fallback
            return False
    else:
        logger.info(f"[DEV EMAIL LOG] To: {to_email} | Subject: {subject} | Token: {token}")
        return True


def send_welcome_email(to_email: str, username: str, verification_token: Optional[str] = None) -> bool:
    subject = "🌸 Welcome to KotobaMaster! ようこそ"
    verify_url = f"{settings.APP_URL}/?verify_token={verification_token}" if verification_token else settings.APP_URL

    text_body = f"""Konnichiwa {username}!

Welcome to KotobaMaster (言葉マスター)! Your Japanese vocabulary mastery journey begins now.

You can start studying Minna no Nihongo Lesson 1 right away.
To verify your email address, click the link below:
{verify_url}

Ganbatte kudasai! (頑張ってください！)
- The KotobaMaster Team
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; }}
        .header {{ text-align: center; margin-bottom: 24px; }}
        .badge {{ background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; display: inline-block; }}
        h1 {{ color: #ffffff; font-size: 24px; margin: 12px 0 6px; }}
        p {{ color: #cbd5e1; line-height: 1.6; font-size: 15px; margin: 12px 0; }}
        .btn {{ display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; margin: 20px 0; text-align: center; }}
        .btn:hover {{ background: #4f46e5; }}
        .footer {{ font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">🌸 ようこそ</span>
          <h1>Welcome to KotobaMaster, {username}!</h1>
        </div>
        <p>Your account is ready. Get ready to master <strong>Minna no Nihongo</strong> vocabulary through scientifically backed Spaced Repetition (SRS) and MCQ recall practice.</p>
        <p>Lesson 1 is already unlocked for you. Practice flashcards, add tricky words to your review queue, and unlock chapters as your mastery grows!</p>
        <div style="text-align: center;">
          <a class="btn" href="{verify_url}" target="_blank">Confirm Email & Start Learning</a>
        </div>
        <div class="footer">
          <p>If you didn't create an account with KotobaMaster, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
    """

    return send_email(to_email, subject, html_body, text_body, email_type="welcome", token=verification_token)


def send_login_notification(to_email: str, username: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> bool:
    subject = "🔐 New Login Detected — KotobaMaster"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    text_body = f"""Hello {username},

We detected a successful login to your KotobaMaster account on {now_str}.
IP Address: {ip_address or 'Unknown'}
Client: {user_agent or 'Unknown Browser'}

If this was you, no action is needed!
If you did not initiate this login, please reset your password immediately at {settings.APP_URL}.

- KotobaMaster Security
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; }}
        .header {{ text-align: center; margin-bottom: 20px; }}
        .badge {{ background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; display: inline-block; }}
        h1 {{ color: #ffffff; font-size: 22px; margin: 12px 0 6px; }}
        p {{ color: #cbd5e1; line-height: 1.6; font-size: 14px; margin: 12px 0; }}
        .info-box {{ background: #0f172a; border-radius: 8px; padding: 14px 18px; margin: 16px 0; border: 1px solid #334155; font-size: 13px; }}
        .info-row {{ margin-bottom: 6px; display: flex; justify-content: space-between; }}
        .info-label {{ color: #94a3b8; }}
        .info-value {{ color: #f8fafc; font-weight: 500; font-family: monospace; }}
        .footer {{ font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">🔐 Security Alert</span>
          <h1>New Login Detected</h1>
        </div>
        <p>Hi <strong>{username}</strong>, your KotobaMaster account was just signed into successfully.</p>
        <div class="info-box">
          <div class="info-row"><span class="info-label">Timestamp:</span> <span class="info-value">{now_str}</span></div>
          <div class="info-row"><span class="info-label">IP Address:</span> <span class="info-value">{ip_address or 'Local / Loopback'}</span></div>
          <div class="info-row"><span class="info-label">Browser:</span> <span class="info-value">{user_agent or 'Standard Web Client'}</span></div>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">If this was you, you can safely disregard this message. If you didn't sign in, please secure your account immediately.</p>
        <div class="footer">
          <p>© KotobaMaster Japanese SRS. Built for Minna no Nihongo learners.</p>
        </div>
      </div>
    </body>
    </html>
    """

    return send_email(to_email, subject, html_body, text_body, email_type="login_alert")


def send_password_reset_email(to_email: str, username: str, reset_token: str) -> bool:
    subject = "🔑 Reset Your KotobaMaster Password"
    reset_url = f"{settings.APP_URL}/?reset_token={reset_token}"

    text_body = f"""Hello {username},

We received a request to reset your password for KotobaMaster.
Click the link below or copy it into your browser to choose a new password:

{reset_url}

This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.

- KotobaMaster Support
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; }}
        .header {{ text-align: center; margin-bottom: 20px; }}
        .badge {{ background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; display: inline-block; }}
        h1 {{ color: #ffffff; font-size: 22px; margin: 12px 0 6px; }}
        p {{ color: #cbd5e1; line-height: 1.6; font-size: 14px; margin: 12px 0; }}
        .token-box {{ background: #0f172a; border-radius: 8px; padding: 12px; margin: 16px 0; border: 1px dashed #475569; text-align: center; font-family: monospace; font-size: 14px; color: #38bdf8; word-break: break-all; }}
        .btn {{ display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; margin: 18px 0; text-align: center; }}
        .btn:hover {{ background: #4f46e5; }}
        .footer {{ font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">🔑 Password Reset</span>
          <h1>Reset Your Password</h1>
        </div>
        <p>Hi <strong>{username}</strong>, we received a request to reset your password for KotobaMaster.</p>
        <p>Click the button below to choose a new secure password. This link is valid for <strong>1 hour</strong>.</p>
        <div style="text-align: center;">
          <a class="btn" href="{reset_url}" target="_blank">Reset Password</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Or use this reset token directly in the app:</p>
        <div class="token-box">{reset_token}</div>
        <div class="footer">
          <p>If you didn't request this reset, your account is safe and you can ignore this message.</p>
        </div>
      </div>
    </body>
    </html>
    """

    return send_email(to_email, subject, html_body, text_body, email_type="password_reset", token=reset_token)


def get_dev_emails() -> List[Dict]:
    """Returns stored emails in chronological order (most recent first)."""
    return list(reversed(dev_mailbox))


def clear_dev_mailbox():
    """Clears the dev mailbox (helpful during testing)."""
    dev_mailbox.clear()
