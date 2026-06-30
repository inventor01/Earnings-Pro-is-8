import os
import resend
from typing import Optional

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
APP_NAME = "Earnings Ninja"

resend.api_key = RESEND_API_KEY

def get_app_url() -> str:
    domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
    if domain:
        return f"https://{domain}"
    domains = os.environ.get("REPLIT_DOMAINS", "")
    if domains:
        return f"https://{domains.split(',')[0]}"
    return "http://localhost:5000"

async def send_password_reset_email(to_email: str, reset_token: str, user_name: Optional[str] = None) -> bool:
    reset_url = f"{get_app_url()}/reset-password?token={reset_token}"
    
    if not RESEND_API_KEY:
        print(f"[Email Service] Resend API key not configured. Reset link: {reset_url}")
        return False
    
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
    
    try:
        params = {
            "from": "Earnings Ninja <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"Reset Your {APP_NAME} Password",
            "html": html_content,
            "text": text_content,
        }
        
        email_response = resend.Emails.send(params)
        print(f"[Email Service] Password reset email sent to {to_email}, id: {email_response.get('id', 'unknown')}")
        return True
    except Exception as e:
        print(f"[Email Service] Failed to send email to {to_email}: {e}")
        print(f"[Email Service] Reset link (fallback): {reset_url}")
        return False


async def send_mfa_code_email(to_email: str, code: str, user_name: Optional[str] = None) -> bool:
    """Email a 6-digit two-factor verification code. Returns True if Resend
    accepted it. When the key is missing (dev), the code is logged so the flow
    is still testable without a real inbox."""
    if not RESEND_API_KEY:
        print(f"[Email Service] Resend API key not configured. MFA code for {to_email}: {code}")
        return False

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
            .code {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #111; background: #fff; border: 2px dashed #84cc16; border-radius: 10px; padding: 18px; margin: 20px 0; }}
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
                <p>Use this code to finish signing in to your {APP_NAME} account:</p>
                <div class="code">{code}</div>
                <div class="warning">
                    <strong>Important:</strong> This code expires in 10 minutes. If you didn't try to sign in, someone may have your password — change it right away.
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

Use this code to finish signing in to your {APP_NAME} account:

{code}

This code expires in 10 minutes. If you didn't try to sign in, change your password right away.

- The {APP_NAME} Team
"""

    try:
        params = {
            "from": "Earnings Ninja <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"Your {APP_NAME} verification code: {code}",
            "html": html_content,
            "text": text_content,
        }
        email_response = resend.Emails.send(params)
        print(f"[Email Service] MFA code email sent to {to_email}, id: {email_response.get('id', 'unknown')}")
        return True
    except Exception as e:
        print(f"[Email Service] Failed to send MFA email to {to_email}: {e}")
        print(f"[Email Service] MFA code (fallback) for {to_email}: {code}")
        return False


async def send_email_verification_email(to_email: str, code: str, user_name: Optional[str] = None) -> bool:
    """Email a 6-digit account-confirmation code (NON-blocking gentle nudge).
    Returns True if Resend accepted it. When the key is missing (dev), the code
    is logged so the flow stays testable without a real inbox."""
    if not RESEND_API_KEY:
        print(f"[Email Service] Resend API key not configured. Email-verify code for {to_email}: {code}")
        return False

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
            .code {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #111; background: #fff; border: 2px dashed #84cc16; border-radius: 8px; padding: 18px; margin: 24px 0; }}
            .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{APP_NAME}</h1>
            </div>
            <div class="content">
                <p>{greeting}</p>
                <p>Welcome aboard! Confirm your email to secure your {APP_NAME} account. Enter this code in the app:</p>
                <div class="code">{code}</div>
                <p>You can keep using the app right away — this just verifies it's really you. The code expires in 24 hours.</p>
                <p>If you didn't create a {APP_NAME} account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p>&copy; {APP_NAME}. Drive smart, earn more.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
{greeting}

Welcome aboard! Confirm your email to secure your {APP_NAME} account.
Enter this code in the app:

{code}

You can keep using the app right away — this just verifies it's really you.
This code expires in 24 hours. If you didn't create an account, ignore this email.

- The {APP_NAME} Team
"""

    try:
        params = {
            "from": "Earnings Ninja <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"Confirm your {APP_NAME} email: {code}",
            "html": html_content,
            "text": text_content,
        }
        email_response = resend.Emails.send(params)
        print(f"[Email Service] Verification email sent to {to_email}, id: {email_response.get('id', 'unknown')}")
        return True
    except Exception as e:
        # Never log the plaintext code on a runtime send failure — that would
        # leak a valid OTP into production logs. The dev no-key branch above is
        # the only place the code is printed (local testing without an inbox).
        print(f"[Email Service] Failed to send verification email to {to_email}: {e}")
        return False


async def send_welcome_email(to_email: str, user_name: Optional[str] = None) -> bool:
    """Send a friendly welcome email right after signup. Best-effort: returns
    True if Resend accepted it, False otherwise (signup must never depend on it)."""
    if not RESEND_API_KEY:
        print(f"[Email Service] Resend API key not configured. Skipping welcome email to {to_email}.")
        return False

    greeting = f"Hi {user_name}," if user_name else "Hi there,"
    app_url = get_app_url()

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
            .feature {{ margin: 8px 0; }}
            .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to {APP_NAME}! 🥷</h1>
            </div>
            <div class="content">
                <p>{greeting}</p>
                <p>Your account is ready. {APP_NAME} helps you track earnings, expenses, mileage, and profit across every gig platform — all in one place.</p>
                <p>Here's what you can do right now:</p>
                <p class="feature">💰 Log earnings the instant a delivery ends</p>
                <p class="feature">📊 Watch your real-time profit and daily goals</p>
                <p class="feature">🚗 Auto-track mileage and expenses</p>
                <p class="feature">📈 See which platforms and hours pay you best</p>
                <p style="text-align: center;">
                    <a href="{app_url}" class="button">Start Tracking</a>
                </p>
                <p>Drive smart, earn more. We're glad you're here.</p>
            </div>
            <div class="footer">
                <p>&copy; {APP_NAME}. Drive smart, earn more.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
{greeting}

Welcome to {APP_NAME}! Your account is ready.

{APP_NAME} helps you track earnings, expenses, mileage, and profit across every
gig platform — all in one place.

What you can do right now:
- Log earnings the instant a delivery ends
- Watch your real-time profit and daily goals
- Auto-track mileage and expenses
- See which platforms and hours pay you best

Drive smart, earn more. We're glad you're here.

- The {APP_NAME} Team
"""

    try:
        params = {
            "from": "Earnings Ninja <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"Welcome to {APP_NAME}! 🥷",
            "html": html_content,
            "text": text_content,
        }
        email_response = resend.Emails.send(params)
        print(f"[Email Service] Welcome email sent to {to_email}, id: {email_response.get('id', 'unknown')}")
        return True
    except Exception as e:
        print(f"[Email Service] Failed to send welcome email to {to_email}: {e}")
        return False
