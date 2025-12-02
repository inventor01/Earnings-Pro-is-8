import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", SMTP_USER)
APP_NAME = "Earnings Ninja"

def get_app_url() -> str:
    domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
    if domain:
        return f"https://{domain}"
    domains = os.environ.get("REPLIT_DOMAINS", "")
    if domains:
        return f"https://{domains.split(',')[0]}"
    return "http://localhost:5000"

async def send_password_reset_email(to_email: str, reset_token: str, user_name: Optional[str] = None) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[Email Service] SMTP not configured. Reset link: {get_app_url()}/reset-password?token={reset_token}")
        return False
    
    reset_url = f"{get_app_url()}/reset-password?token={reset_token}"
    
    greeting = f"Hi {user_name}," if user_name else "Hi,"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #84cc16, #22c55e); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
            .header h1 {{ color: white; margin: 0; font-size: 28px; }}
            .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }}
            .button {{ display: inline-block; background: #84cc16; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }}
            .button:hover {{ background: #65a30d; }}
            .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            .warning {{ background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{APP_NAME}</h1>
            </div>
            <div class="content">
                <p>{greeting}</p>
                <p>We received a request to reset your password for your {APP_NAME} account.</p>
                <p>Click the button below to create a new password:</p>
                <p style="text-align: center;">
                    <a href="{reset_url}" class="button">Reset Password</a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #0066cc;">{reset_url}</p>
                <div class="warning">
                    <strong>Important:</strong> This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                </div>
            </div>
            <div class="footer">
                <p>This email was sent by {APP_NAME}</p>
                <p>Track your delivery driver earnings like a ninja!</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
{greeting}

We received a request to reset your password for your {APP_NAME} account.

Click this link to create a new password:
{reset_url}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

- The {APP_NAME} Team
"""
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Reset Your {APP_NAME} Password"
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    
    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))
    
    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"[Email Service] Password reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[Email Service] Failed to send email to {to_email}: {e}")
        print(f"[Email Service] Reset link (fallback): {reset_url}")
        return False
