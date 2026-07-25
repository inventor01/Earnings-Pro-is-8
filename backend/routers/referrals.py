"""Referral program endpoints.

Invite-a-driver sharing: each user gets a unique referral code and share link,
and referrals are recorded for attribution. The "1 free month" promotional
reward was RETIRED (Jul 2026): no RevenueCat grants are made anymore. The
`rewards_*` fields in the API response are kept (frozen at their historical
values) so older app builds that still render them keep working.
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

logger = logging.getLogger(__name__)

router = APIRouter()

# Historical cap from the retired free-month promotion. Still reported in the
# API response so old clients render sensible numbers.
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
    """Record a referral of *referee* attributed to *raw_code*'s owner.

    Attribution only — the free-month reward promotion is retired, so no
    entitlement grants are made. Returns True if a new referral was recorded;
    False when the code is invalid, is the referee's own code, or the referee
    has already been referred. Never raises for these "soft" cases so it can
    be called inline from signup without aborting account creation.
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

    # Free-month promotion retired: the referral is recorded for attribution
    # only. No RevenueCat promotional grants are made for either party.
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
        message="Referral code applied!",
        referee_reward_granted=bool(referral and referral.referee_reward_granted),
    )
