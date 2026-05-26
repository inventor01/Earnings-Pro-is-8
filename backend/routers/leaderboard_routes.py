from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from backend.db import get_db
from backend.models import AuthUser, Friend, Achievement, Congratulation, Entry, EntryType
from backend.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional, Literal

router = APIRouter()

# ---- Schemas --------------------------------------------------------------

class UserLeaderboardItem(BaseModel):
    # id is included only for the caller's own row and for accepted friends.
    # For strangers it is omitted so the response cannot be used to map
    # display names to stable account identifiers (and so the frontend has
    # nothing to feed back into /add-friend or /send-congrats).
    id: Optional[str] = None
    username: str
    points: int
    daily_streak: int
    # total_earnings is personal financial data. Only friends (mutual consent)
    # see each other's totals. For strangers we return None.
    total_earnings: Optional[float] = None
    is_friend: bool = False
    profile_image_url: Optional[str] = None
    # NOTE: email is intentionally not included. Exposing email addresses on
    # a public leaderboard to any authenticated user is a confidentiality
    # leak and enables targeted phishing/harvesting.

class AddFriendRequest(BaseModel):
    # Email only. Previously also accepted `first_name` as a username, which
    # made enumeration trivial. Email is at least a verified contact channel.
    friend_email_or_username: str

class SendCongratRequest(BaseModel):
    friend_id: str
    message: str = ""

class FriendRequestItem(BaseModel):
    request_id: int
    from_username: str
    profile_image_url: Optional[str] = None

class RespondFriendRequest(BaseModel):
    request_id: int
    action: Literal["accept", "decline"]

# ---- Helpers --------------------------------------------------------------

def calculate_user_points(db: Session, user_id: str) -> int:
    """Calculate points based on earnings and entry count."""
    entries = db.query(Entry).filter(Entry.user_id == user_id).all()
    total_earnings = sum(float(e.amount) for e in entries if float(e.amount) > 0)
    points = int(total_earnings) + (len(entries) * 10)
    return points

def calculate_total_earnings(db: Session, user_id: str) -> float:
    """Sum of ORDER-type entry amounts for the user."""
    total = db.query(func.coalesce(func.sum(Entry.amount), 0)).filter(
        Entry.user_id == user_id,
        Entry.type == EntryType.ORDER,
    ).scalar()
    return float(total or 0)

def _display_name(user: AuthUser) -> str:
    """Public display name. Never falls back to email — that would leak
    contact info via the username field for users who haven't set a name."""
    if user.first_name:
        return user.first_name
    # Stable but non-identifying placeholder derived from the last 4 chars
    # of the user id (which for password users is a uuid and for Apple users
    # is "apple:<sub>"). Doesn't expose email or the full id.
    suffix = (user.id or "")[-4:] or "0000"
    return f"Driver {suffix}"

# ---- Endpoints ------------------------------------------------------------

@router.get("/leaderboard")
async def get_leaderboard(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Global leaderboard. Strangers' rows include only display name,
    points, and (placeholder) streak. Email, total earnings, and the
    stable user id are restricted to accepted friends."""

    all_users = db.query(AuthUser).filter(
        AuthUser.id != current_user.id,
        AuthUser.id != "default-user",
    ).all()

    # Resolve the caller's accepted friend set once, so we can gate which
    # rows include the privileged fields.
    friend_ids = {
        f.friend_id
        for f in db.query(Friend).filter(
            Friend.user_id == current_user.id,
            Friend.status == "accepted",
        ).all()
    }

    leaderboard_items: List[UserLeaderboardItem] = []
    for user in all_users:
        points = calculate_user_points(db, user.id)
        is_friend = user.id in friend_ids
        leaderboard_items.append(UserLeaderboardItem(
            id=user.id if is_friend else None,
            username=_display_name(user),
            points=points,
            daily_streak=0,
            total_earnings=calculate_total_earnings(db, user.id) if is_friend else None,
            is_friend=is_friend,
            profile_image_url=user.profile_image_url,
        ))

    leaderboard_items.sort(key=lambda x: x.points, reverse=True)
    friends = [item for item in leaderboard_items if item.is_friend]
    friends.sort(key=lambda x: x.points, reverse=True)

    achievements = db.query(Achievement).filter(
        Achievement.user_id == current_user.id
    ).all()

    return {
        "leaderboard": leaderboard_items[:50],
        "friends": friends,
        "achievements": [
            {"title": a.title, "description": a.description, "icon": a.icon}
            for a in achievements
        ],
    }

@router.post("/leaderboard/add-friend")
async def add_friend(
    request: AddFriendRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a friend request. Always returns the same generic response so
    that an attacker cannot use this endpoint as an account-existence
    oracle for arbitrary email addresses. The request is recorded as
    'pending'; the target must explicitly accept it via
    /leaderboard/friend-requests/respond. No reverse row is written until
    acceptance — a user can never be silently added to a stranger's
    friend list."""

    generic_response = {
        "success": True,
        "message": "If that account exists, a friend request has been sent.",
    }

    raw = (request.friend_email_or_username or "").strip().lower()
    if not raw:
        return generic_response

    # Email-only lookup (case-insensitive). Username lookup by first_name
    # was removed — first_name is not unique, not verified, and made
    # enumeration trivial.
    friend = db.query(AuthUser).filter(func.lower(AuthUser.email) == raw).first()

    # Treat "no match" and "self-request" identically to the success path
    # so response timing/shape doesn't disclose either condition.
    if not friend or friend.id == current_user.id:
        return generic_response

    existing = db.query(Friend).filter(
        Friend.user_id == current_user.id,
        Friend.friend_id == friend.id,
    ).first()

    if existing:
        # Idempotent: already pending or already accepted — no-op, same
        # generic response (don't disclose existing relationship state).
        return generic_response

    # Insert ONE row only: a pending request from caller -> target. The
    # reverse row is only written when the target accepts.
    db.add(Friend(
        user_id=current_user.id,
        friend_id=friend.id,
        status="pending",
    ))
    db.commit()
    return generic_response

@router.get("/leaderboard/friend-requests")
async def list_friend_requests(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pending friend requests addressed to the caller."""
    rows = db.query(Friend).filter(
        Friend.friend_id == current_user.id,
        Friend.status == "pending",
    ).order_by(desc(Friend.created_at)).all()

    out: List[FriendRequestItem] = []
    for row in rows:
        sender = db.query(AuthUser).filter(AuthUser.id == row.user_id).first()
        if not sender:
            continue
        out.append(FriendRequestItem(
            request_id=row.id,
            from_username=_display_name(sender),
            profile_image_url=sender.profile_image_url,
        ))
    return {"requests": out}

@router.post("/leaderboard/friend-requests/respond")
async def respond_friend_request(
    body: RespondFriendRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept or decline a pending friend request. Only the addressee
    (friend_id) can respond; the requester cannot self-accept."""
    req = db.query(Friend).filter(
        Friend.id == body.request_id,
        Friend.friend_id == current_user.id,
        Friend.status == "pending",
    ).first()
    if not req:
        # Generic 404 — don't disclose whether the id exists for someone else.
        raise HTTPException(status_code=404, detail="Request not found")

    if body.action == "decline":
        db.delete(req)
        db.commit()
        return {"success": True}

    # Accept: mark requester->target as accepted AND create the reverse
    # row (target->requester) so both sides see each other. The reverse
    # row is created here, NOT at request time, which is the entire point
    # of the pending workflow.
    req.status = "accepted"
    reverse = db.query(Friend).filter(
        Friend.user_id == current_user.id,
        Friend.friend_id == req.user_id,
    ).first()
    if reverse:
        reverse.status = "accepted"
    else:
        db.add(Friend(
            user_id=current_user.id,
            friend_id=req.user_id,
            status="accepted",
        ))
    db.commit()
    return {"success": True}

@router.post("/leaderboard/send-congrats")
async def send_congratulations(
    request: SendCongratRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send congratulations to an accepted friend."""

    friend_record = db.query(Friend).filter(
        Friend.user_id == current_user.id,
        Friend.friend_id == request.friend_id,
        Friend.status == "accepted",
    ).first()

    if not friend_record:
        # Generic 403 — don't disclose whether the target id exists.
        raise HTTPException(status_code=403, detail="Must be friends to send congratulations")

    db.add(Congratulation(
        from_user_id=current_user.id,
        to_user_id=request.friend_id,
        message=request.message or "Great job! 🎉",
    ))
    db.commit()
    return {"success": True, "message": "Congratulations sent"}

@router.get("/leaderboard/recent-congrats")
async def get_recent_congrats(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recent congratulations received by the caller."""
    congrats = db.query(Congratulation).filter(
        Congratulation.to_user_id == current_user.id
    ).order_by(desc(Congratulation.created_at)).limit(10).all()

    result = []
    for c in congrats:
        from_user = db.query(AuthUser).filter(AuthUser.id == c.from_user_id).first()
        if from_user:
            result.append({
                "from_username": _display_name(from_user),
                "message": c.message,
                "created_at": c.created_at,
            })
    return {"congrats": result}
