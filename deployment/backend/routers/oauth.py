from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from backend.db import get_db
from backend.models import ApiCredential, PlatformIntegration
import httpx
import os

router = APIRouter()

# OAuth credentials from environment
UBER_CLIENT_ID = os.getenv("UBER_CLIENT_ID", "demo_uber_client")
UBER_CLIENT_SECRET = os.getenv("UBER_CLIENT_SECRET", "demo_uber_secret")
UBER_REDIRECT_URI = os.getenv("UBER_REDIRECT_URI", "http://localhost:5000/api/oauth/uber/callback")

SHIPT_CLIENT_ID = os.getenv("SHIPT_CLIENT_ID", "demo_shipt_client")
SHIPT_CLIENT_SECRET = os.getenv("SHIPT_CLIENT_SECRET", "demo_shipt_secret")
SHIPT_REDIRECT_URI = os.getenv("SHIPT_REDIRECT_URI", "http://localhost:5000/api/oauth/shipt/callback")


@router.get("/oauth/uber/authorize")
async def uber_authorize():
    """Redirect to Uber OAuth"""
    auth_url = "https://login.uber.com/oauth/v2/authorize"
    params = {
        "client_id": UBER_CLIENT_ID,
        "redirect_uri": UBER_REDIRECT_URI,
        "response_type": "code",
        "scope": "delivery.read delivery.write"
    }
    
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return {"auth_url": f"{auth_url}?{query_string}"}


@router.get("/oauth/uber/callback")
async def uber_callback(code: str = Query(...), db: Session = Depends(get_db)):
    """Handle Uber OAuth callback"""
    try:
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://login.uber.com/oauth/v2/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": UBER_CLIENT_ID,
                    "client_secret": UBER_CLIENT_SECRET,
                    "redirect_uri": UBER_REDIRECT_URI
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get token from Uber")
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            
            # Save credentials
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            cred = db.query(ApiCredential).filter(
                ApiCredential.platform == PlatformIntegration.UBER
            ).first()
            
            if cred:
                cred.access_token = access_token
                cred.refresh_token = refresh_token
                cred.token_expires_at = token_expires_at
                cred.is_active = 1
            else:
                cred = ApiCredential(
                    platform=PlatformIntegration.UBER,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    is_active=1
                )
                db.add(cred)
            
            db.commit()
            
            return {"message": "Uber account connected successfully", "platform": "UBER"}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/oauth/shipt/authorize")
async def shipt_authorize():
    """Redirect to Shipt OAuth"""
    auth_url = "https://api.shipt.com/oauth/authorize"
    params = {
        "client_id": SHIPT_CLIENT_ID,
        "redirect_uri": SHIPT_REDIRECT_URI,
        "response_type": "code",
        "scope": "orders.read orders.write"
    }
    
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return {"auth_url": f"{auth_url}?{query_string}"}


@router.get("/oauth/shipt/callback")
async def shipt_callback(code: str = Query(...), db: Session = Depends(get_db)):
    """Handle Shipt OAuth callback"""
    try:
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.shipt.com/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": SHIPT_CLIENT_ID,
                    "client_secret": SHIPT_CLIENT_SECRET,
                    "redirect_uri": SHIPT_REDIRECT_URI
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get token from Shipt")
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            
            # Save credentials
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            cred = db.query(ApiCredential).filter(
                ApiCredential.platform == PlatformIntegration.SHIPT
            ).first()
            
            if cred:
                cred.access_token = access_token
                cred.refresh_token = refresh_token
                cred.token_expires_at = token_expires_at
                cred.is_active = 1
            else:
                cred = ApiCredential(
                    platform=PlatformIntegration.SHIPT,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    is_active=1
                )
                db.add(cred)
            
            db.commit()
            
            return {"message": "Shipt account connected successfully", "platform": "SHIPT"}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/oauth/{platform}/disconnect")
async def disconnect_platform(platform: str, db: Session = Depends(get_db)):
    """Disconnect an OAuth account"""
    platform_enum = PlatformIntegration[platform.upper()]
    
    cred = db.query(ApiCredential).filter(
        ApiCredential.platform == platform_enum
    ).first()
    
    if not cred:
        raise HTTPException(status_code=404, detail=f"No connection found for {platform}")
    
    cred.is_active = 0
    db.commit()
    
    return {"message": f"{platform} account disconnected"}


@router.get("/oauth/status")
async def get_oauth_status(db: Session = Depends(get_db)):
    """Get status of all OAuth connections"""
    credentials = db.query(ApiCredential).all()
    
    status = {}
    for cred in credentials:
        status[cred.platform.value] = {
            "connected": bool(cred.is_active),
            "token_expires_at": cred.token_expires_at.isoformat() if cred.token_expires_at else None
        }
    
    return status
