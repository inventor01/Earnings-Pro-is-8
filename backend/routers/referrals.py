"""Referral program endpoints.

"Refer a driver → you both get 1 month of Pro free." The referrer's reward is
CAPPED (default 3 free months total) to bound abuse; the referee always gets
exactly one free month, and only once (a user can be referred a single time).

Rewards are granted as RevenueCat promotional entitlements keyed by the
backend user id (the client calls Purchases.logIn(user.id), so the RevenueCat
app_user_id == AuthUser.id). Grants are best-effort: if RevenueCat is
unreachable the Referral row is still recorded with the matching
*_reward_granted flag left False, so nothing double-counts and a retry can
re-grant later.
"""

import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.db import get_db
from backend.models import AuthUser, Referral
from backend.services.revenuecat_service import grant_promotional_month

logger = logging.getLogger(__name__)

router = APIRouter()

# Max free months a single referrer can earn from referrals.
REFERRER_REWARD_CAP = 3

# Code alphabet excludes easily-confused characters (0/O, 1/I/L) so codes are
# easy to read aloud and type.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 7


class ReferralInfo(BaseModel):
    code: str
    referred_count: int
    rewards_earned: int
    rewards_cap: int
    rewards_remaining: int


class RedeemRequest(BaseModel):
    code: str


class RedeemResponse(BaseModel):
    success: bool
    message: str
    referee_reward_granted: bool


def _generate_unique_code(db: Session) -> str:
    """Generate a referral code not already in use. Retries on the rare
    collision; gives up after a bounded number of tries to avoid an infinite
    loop if the keyspace were somehow exhausted."""
    for _ in range(10):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        exists = db.query(AuthUser).filter(AuthUser.referral_code == code).first()
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Could not generate a referral code")


def _ensure_code(db: Session, user: AuthUser) -> str:
    """Return the user's referral code, generating + persisting one on first use.

    Retries on the unique-constraint race where two requests (for this user, or
    for two different users that happened to roll the same code) commit at once:
    the loser catches IntegrityError, re-reads, and either adopts the code that
    won for this user or regenerates a fresh one.
    """
    if user.referral_code:
        return user.referral_code
    for _ in range(5):
        user.referral_code = _generate_unique_code(db)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            db.refresh(user)
            if user.referral_code:
                return user.referral_code
            continue  # a different user took that code; roll a new one
        db.refresh(user)
        return user.referral_code
    raise HTTPException(status_code=500, detail="Could not assign a referral code")


async def apply_referral(db: Session, referee: AuthUser, raw_code: str) -> bool:
    """Credit *raw_code*'s owner with a referral of *referee*.

    Returns True if a new referral was recorded (whether or not the RevenueCat
    grant itself succeeded). Returns False when the code is invalid, is the
    referee's own code, or the referee has already been referred. Never raises
    for these "soft" cases so it can be called inline from signup without
    aborting account creation.
    """
    code = (raw_code or "").strip().upper()
    if not code:
        return False

    # A user can only ever be referred once.
    already = db.query(Referral).filter(Referral.referee_id == referee.id).first()
    if already:
        return False

    referrer = db.query(AuthUser).filter(AuthUser.referral_code == code).first()
    if not referrer:
        return False
    if referrer.id == referee.id:
        return False  # no self-referral

    # Record the referral. The unique constraint on referee_id is the real
    # guard against a concurrent double-redeem: if a parallel request inserted
    # first, our commit raises IntegrityError and we treat it as "already
    # referred" rather than 500-ing.
    referral = Referral(referrer_id=referrer.id, referee_id=referee.id)
    db.add(referral)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    db.refresh(referral)

    # Referee always gets their one free month.
    try:
        if await grant_promotional_month(referee.id):
            referral.referee_reward_granted = True
            db.commit()
    except Exception as exc:
        logger.warning("Referee grant failed for %s: %s", referee.id, exc)
        db.rollback()

    # Referrer gets a free month only if they're still under the cap. Enforce
    # the cap atomically: lock the referrer row so concurrent referrals for the
    # same referrer serialize, then count rewards already granted (not just
    # referrals recorded, so a failed/pending grant doesn't permanently consume
    # a slot) and optimistically "reserve" a slot by flagging THIS referral
    # before releasing the lock. The slow RevenueCat HTTP call happens after the
    # lock is released; if it fails we hand the slot back.
    reserved = False
    try:
        db.query(AuthUser).filter(AuthUser.id == referrer.id).with_for_update().first()
        granted_count = (
            db.query(Referral)
            .filter(
                Referral.referrer_id == referrer.id,
                Referral.referrer_reward_granted == True,  # noqa: E712
            )
            .count()
        )
        if granted_count < REFERRER_REWARD_CAP:
            referral.referrer_reward_granted = True
            reserved = True
        db.commit()  # releases the row lock
    except Exception as exc:
        logger.warning("Referrer cap check failed for %s: %s", referrer.id, exc)
        db.rollback()

    if reserved:
        granted = False
        try:
            granted = await grant_promotional_month(referrer.id)
        except Exception as exc:
            logger.warning("Referrer grant failed for %s: %s", referrer.id, exc)
        if not granted:
            # Grant didn't land — release the reserved slot so it isn't wasted.
            referral.referrer_reward_granted = False
            db.commit()

    return True


@router.get("/referrals/me", response_model=ReferralInfo)
async def get_my_referral_info(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReferralInfo:
    code = _ensure_code(db, current_user)
    referred_count = (
        db.query(Referral).filter(Referral.referrer_id == current_user.id).count()
    )
    rewards_earned = (
        db.query(Referral)
        .filter(
            Referral.referrer_id == current_user.id,
            Referral.referrer_reward_granted == True,  # noqa: E712
        )
        .count()
    )
    return ReferralInfo(
        code=code,
        referred_count=referred_count,
        rewards_earned=rewards_earned,
        rewards_cap=REFERRER_REWARD_CAP,
        rewards_remaining=max(0, REFERRER_REWARD_CAP - rewards_earned),
    )


@router.post("/referrals/redeem", response_model=RedeemResponse)
async def redeem_referral(
    body: RedeemRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RedeemResponse:
    """Apply a referral code for the signed-in user (for those who didn't enter
    one at signup). Each user can redeem at most once."""
    already = db.query(Referral).filter(Referral.referee_id == current_user.id).first()
    if already:
        raise HTTPException(status_code=409, detail="You've already used a referral code.")

    ok = await apply_referral(db, current_user, body.code)
    if not ok:
        raise HTTPException(status_code=400, detail="That referral code is invalid.")

    referral = db.query(Referral).filter(Referral.referee_id == current_user.id).first()
    return RedeemResponse(
        success=True,
        message="You've earned a free month of Earnings Ninja Pro!",
        referee_reward_granted=bool(referral and referral.referee_reward_granted),
    )
