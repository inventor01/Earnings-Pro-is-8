import asyncio
import os
import resend
from typing import Optional

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
APP_NAME = "Earnings Ninja"

# Sender address. `onboarding@resend.dev` is Resend's shared sandbox sender and
# can ONLY deliver to the Resend account owner's own address — every email to a
# real user is rejected. In production set RESEND_FROM to an address on a domain
# verified at resend.com/domains (e.g. "Earnings Ninja <noreply@earningsninja.app>").
RESEND_FROM = os.environ.get("RESEND_FROM", "Earnings Ninja <onboarding@resend.dev>")

# Reply-To. The "From" must be on a domain we verify in Resend (a @gmail.com can
# never be a verified sender — Google owns gmail.com), but replies CAN be routed
# to any inbox. Driver replies to transactional emails land here. Override with
# RESEND_REPLY_TO; set to empty to omit the header entirely.
RESEND_REPLY_TO = os.environ.get("RESEND_REPLY_TO", "earningsninjaapp@gmail.com").strip()

resend.api_key = RESEND_API_KEY

def get_app_url() -> str:
    # Prefer an explicit public URL so links work on hosts that don't set the
    # Replit env vars (e.g. Railway in production). Without this, reset/welcome
    # links fall back to http://localhost:5000 and are broken for real users.
    explicit = (
        os.environ.get("PUBLIC_APP_URL", "")
        or os.environ.get("APP_BASE_URL", "")
        or os.environ.get("FRONTEND_URL", "")
    ).strip()
    if explicit:
        return explicit.rstrip("/")
    domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
    if domain:
        return f"https://{domain}"
    domains = os.environ.get("REPLIT_DOMAINS", "")
    if domains:
        return f"https://{domains.split(',')[0]}"
    # Railway injects this automatically for any service with a public domain, so
    # production reset/welcome links resolve with zero env config. We use the
    # Railway origin (not the earningsninja.app vanity domain) because it serves
    # landing/dist + /api on the same origin with no 301 that could drop the
    # ?token= query param.
    railway = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip()
    if railway:
        return f"https://{railway.rstrip('/')}"
    return "http://localhost:5000"

async def send_password_reset_email(to_email: str, reset_token: str, user_name: Optional[str] = None) -> bool:
    reset_url = f"{get_app_url()}/reset-password?token={reset_token}"
    
    if not RESEND_API_KEY:
        print(f"[Email Service] Resend API key not configured. Reset link: {reset_url}")
        return False
    
    greeting = f"Hi {user_name}," if user_name else "Hi,"
    
    # NOTE: all styling is INLINE on each element. Email clients (Gmail in
    # particular) strip <head><style> blocks, which would otherwise collapse the
    # branded button into a plain text link. The button uses a bulletproof
    # bgcolor-on-<td> + padded <a> pattern so it renders as a solid button across
    # Gmail, Apple Mail, and Outlook, including on mobile.
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reset your {APP_NAME} password</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0a0a0a;">Reset your {APP_NAME} password — this secure link expires in 1 hour.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:#111111;border:1px solid #262626;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center" style="padding:32px 24px 20px;">
<span style="font-size:24px;font-weight:800;color:#facc15;letter-spacing:0.3px;">🥷 {APP_NAME}</span>
</td></tr>
<tr><td style="padding:0 28px;">
<h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#ffffff;">Reset your password</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#d4d4d8;">{greeting}</p>
<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#a1a1aa;">We got a request to reset the password for your {APP_NAME} account. Tap the button below to choose a new one.</p>
</td></tr>
<tr><td align="center" style="padding:24px 28px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" bgcolor="#facc15" style="border-radius:10px;">
<a href="{reset_url}" target="_blank" style="display:inline-block;padding:16px 44px;font-size:16px;font-weight:800;color:#000000;text-decoration:none;border-radius:10px;background-color:#facc15;">Reset Password</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 28px 0;">
<p style="margin:0 0 6px;font-size:13px;color:#71717a;">Or paste this link into your browser:</p>
<p style="margin:0 0 20px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{reset_url}" style="color:#facc15;text-decoration:underline;">{reset_url}</a></p>
</td></tr>
<tr><td style="padding:0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1c1917;border:1px solid #3f3206;border-radius:10px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0;font-size:13px;line-height:1.5;color:#e4c95b;">⏳ This link expires in <strong>1 hour</strong> and can only be used once. If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:24px 28px 28px;">
<p style="margin:0;font-size:12px;color:#52525b;">{APP_NAME} · Drive smart, earn more.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""

    text_content = f"""{greeting}

We received a request to reset your password for your {APP_NAME} account.

Reset your password here:
{reset_url}

This link expires in 1 hour and can only be used once.

If you didn't request a password reset, you can safely ignore this email — your password won't change.

- The {APP_NAME} Team
"""
    
    try:
        params = {
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": f"Reset Your {APP_NAME} Password",
            "html": html_content,
            "text": text_content,
            **({"reply_to": RESEND_REPLY_TO} if RESEND_REPLY_TO else {}),
        }
        
        # resend.Emails.send is a synchronous (blocking) HTTP call. Running it
        # directly inside an async route/background task stalls the whole event
        # loop until Resend responds, serializing every other request behind it.
        # Offload to a worker thread so dispatch is non-blocking and concurrent.
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        print(f"[Email Service] Password reset email sent to {to_email}, id: {email_response.get('id', 'unknown')}")
        return True
    except Exception as e:
        # Never log the reset URL on a runtime send failure — it carries a live
        # reset token (account-takeover secret). The dev no-key branch above is
        # the only place the link is printed (local testing without an inbox).
        print(f"[Email Service] Failed to send email to {to_email}: {e}")
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
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": f"Your {APP_NAME} verification code: {code}",
            "html": html_content,
            "text": text_content,
            **({"reply_to": RESEND_REPLY_TO} if RESEND_REPLY_TO else {}),
        }
        # resend.Emails.send is a synchronous (blocking) HTTP call. Running it
        # directly inside an async route/background task stalls the whole event
        # loop until Resend responds, serializing every other request behind it.
        # Offload to a worker thread so dispatch is non-blocking and concurrent.
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        print(f"[Email Service] MFA code email sent to {to_email}, id: {email_response.get('id', 'unknown')}")
        return True
    except Exception as e:
        # Never log the plaintext MFA code on a runtime send failure — that would
        # leak a valid OTP into production logs. The dev no-key branch above is
        # the only place the code is printed (local testing without an inbox).
        print(f"[Email Service] Failed to send MFA email to {to_email}: {e}")
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
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": f"Confirm your {APP_NAME} email: {code}",
            "html": html_content,
            "text": text_content,
            **({"reply_to": RESEND_REPLY_TO} if RESEND_REPLY_TO else {}),
        }
        # resend.Emails.send is a synchronous (blocking) HTTP call. Running it
        # directly inside an async route/background task stalls the whole event
        # loop until Resend responds, serializing every other request behind it.
        # Offload to a worker thread so dispatch is non-blocking and concurrent.
        email_response = await asyncio.to_thread(resend.Emails.send, params)
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
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": f"Welcome to {APP_NAME}! 🥷",
            "html": html_content,
            "text": text_content,
            **({"reply_to": RESEND_REPLY_TO} if RESEND_REPLY_TO else {}),
        }
        # resend.Emails.send is a synchronous (blocking) HTTP call. Running it
        # directly inside an async route/background task stalls the whole event
        # loop until Resend responds, serializing every other request behind it.
        # Offload to a worker thread so dispatch is non-blocking and concurrent.
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        print(f"[Email Service] Welcome email sent to {to_email}, id: {email_response.get('id', 'unknown')}")
        return True
    except Exception as e:
        print(f"[Email Service] Failed to send welcome email to {to_email}: {e}")
        return False
