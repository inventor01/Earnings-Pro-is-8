from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os
import secrets

from backend.db import get_db
from backend.models import CreativeContentJob

router = APIRouter(prefix="/api/creative", tags=["creative-os"])

ALLOWED_PAGES = {"ninja", "brand", "media"}
ALLOWED_STATUSES = {
    "idea",
    "needs_approval",
    "approved",
    "storyboard",
    "rendering",
    "qa",
    "ready_to_post",
    "scheduled",
    "posted",
    "winner",
    "rejected",
    "failed",
    "archived",
}


def _require_creative_admin(request: Request) -> None:
    expected = os.getenv("CREATIVE_OS_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Creative OS is not configured")
    provided = request.headers.get("authorization", "")
    if not secrets.compare_digest(provided, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _score(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return round(max(0.0, min(10.0, float(value))), 2)


def _weighted_total(body: "CreativeJobCreate") -> Optional[float]:
    parts = {
        "virality": _score(body.virality_score),
        "ninja": _score(body.ninja_fit_score),
        "simplicity": _score(body.simplicity_score),
        "originality": _score(body.originality_score),
        "cost": _score(body.cost_efficiency_score),
        "brand": _score(body.brand_fit_score),
    }
    if any(v is None for v in parts.values()):
        return None
    total = (
        parts["virality"] * 0.30
        + parts["ninja"] * 0.20
        + parts["simplicity"] * 0.15
        + parts["originality"] * 0.15
        + parts["cost"] * 0.10
        + parts["brand"] * 0.10
    )
    return round(total, 2)


class CreativeJobCreate(BaseModel):
    content_id: str = Field(min_length=3, max_length=80)
    page: str
    status: str = "idea"
    title: str = Field(min_length=1, max_length=240)
    reference_url: Optional[str] = None
    reference_notes: Optional[str] = None
    format_type: Optional[str] = None
    source: Optional[str] = None
    hook: Optional[str] = None
    beat_sheet: Optional[str] = None
    caption: Optional[str] = None
    cta: Optional[str] = None
    tracking_url: Optional[str] = None
    virality_score: Optional[float] = None
    ninja_fit_score: Optional[float] = None
    simplicity_score: Optional[float] = None
    originality_score: Optional[float] = None
    cost_efficiency_score: Optional[float] = None
    brand_fit_score: Optional[float] = None
    generation_model: Optional[str] = None
    expected_cost: Optional[float] = None
    agent_note: Optional[str] = None

    @field_validator("page")
    @classmethod
    def _page_ok(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_PAGES:
            raise ValueError("Unsupported page")
        return value

    @field_validator("status")
    @classmethod
    def _status_ok(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_STATUSES:
            raise ValueError("Unsupported status")
        return value


class CreativeJobPatch(BaseModel):
    status: Optional[str] = None
    owner_note: Optional[str] = None
    agent_note: Optional[str] = None
    caption: Optional[str] = None
    cta: Optional[str] = None
    generation_model: Optional[str] = None
    expected_cost: Optional[float] = None
    render_job_id: Optional[str] = None
    render_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    views: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None
    clicks: Optional[int] = None
    conversions: Optional[int] = None
    outlier_multiple: Optional[float] = None

    @field_validator("status")
    @classmethod
    def _status_ok(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().lower()
        if value not in ALLOWED_STATUSES:
            raise ValueError("Unsupported status")
        return value


def _serialize(row: CreativeContentJob) -> dict:
    return {
        "id": row.id,
        "content_id": row.content_id,
        "page": row.page,
        "status": row.status,
        "title": row.title,
        "reference_url": row.reference_url,
        "reference_notes": row.reference_notes,
        "format_type": row.format_type,
        "source": row.source,
        "hook": row.hook,
        "beat_sheet": row.beat_sheet,
        "caption": row.caption,
        "cta": row.cta,
        "tracking_url": row.tracking_url,
        "scores": {
            "virality": row.virality_score,
            "ninja_fit": row.ninja_fit_score,
            "simplicity": row.simplicity_score,
            "originality": row.originality_score,
            "cost_efficiency": row.cost_efficiency_score,
            "brand_fit": row.brand_fit_score,
            "total": row.total_score,
        },
        "generation_model": row.generation_model,
        "expected_cost": row.expected_cost,
        "render_job_id": row.render_job_id,
        "render_url": row.render_url,
        "thumbnail_url": row.thumbnail_url,
        "metrics": {
            "views": row.views,
            "likes": row.likes,
            "comments": row.comments,
            "shares": row.shares,
            "clicks": row.clicks,
            "conversions": row.conversions,
            "outlier_multiple": row.outlier_multiple,
        },
        "owner_note": row.owner_note,
        "agent_note": row.agent_note,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/summary")
def creative_summary(request: Request, db: Session = Depends(get_db)):
    _require_creative_admin(request)
    rows = db.query(CreativeContentJob).all()
    by_status: dict[str, int] = {}
    spend = 0.0
    for row in rows:
        by_status[row.status] = by_status.get(row.status, 0) + 1
        spend += float(row.expected_cost or 0.0)
    needs_you = [
        _serialize(row)
        for row in sorted(
            (r for r in rows if r.status == "needs_approval"),
            key=lambda x: x.total_score or 0.0,
            reverse=True,
        )[:3]
    ]
    winners = [
        _serialize(row)
        for row in sorted(
            (r for r in rows if r.status == "winner"),
            key=lambda x: x.outlier_multiple or 0.0,
            reverse=True,
        )[:5]
    ]
    return {
        "total": len(rows),
        "by_status": by_status,
        "projected_spend": round(spend, 2),
        "needs_you": needs_you,
        "winners": winners,
    }


@router.get("/jobs")
def list_creative_jobs(
    request: Request,
    status: Optional[str] = None,
    page: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    query = db.query(CreativeContentJob)
    if status:
        if status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=422, detail="Unsupported status")
        query = query.filter(CreativeContentJob.status == status)
    if page:
        if page not in ALLOWED_PAGES:
            raise HTTPException(status_code=422, detail="Unsupported page")
        query = query.filter(CreativeContentJob.page == page)
    rows = query.order_by(CreativeContentJob.created_at.desc()).limit(min(max(limit, 1), 250)).all()
    return {"jobs": [_serialize(row) for row in rows]}


@router.post("/jobs")
def create_creative_job(
    request: Request,
    body: CreativeJobCreate,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    existing = db.query(CreativeContentJob).filter(
        CreativeContentJob.content_id == body.content_id
    ).first()
    if existing:
        return _serialize(existing)

    values = body.model_dump()
    # Scores are normalized before persistence, so remove the raw values from
    # the generic payload instead of passing the same kwargs twice.
    for score_key in (
        "virality_score",
        "ninja_fit_score",
        "simplicity_score",
        "originality_score",
        "cost_efficiency_score",
        "brand_fit_score",
    ):
        values.pop(score_key, None)

    total_score = _weighted_total(body)
    row = CreativeContentJob(
        **values,
        virality_score=_score(body.virality_score),
        ninja_fit_score=_score(body.ninja_fit_score),
        simplicity_score=_score(body.simplicity_score),
        originality_score=_score(body.originality_score),
        cost_efficiency_score=_score(body.cost_efficiency_score),
        brand_fit_score=_score(body.brand_fit_score),
        total_score=total_score,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.patch("/jobs/{job_id}")
def patch_creative_job(
    job_id: int,
    request: Request,
    body: CreativeJobPatch,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    row = db.query(CreativeContentJob).filter(CreativeContentJob.id == job_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Creative job not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.post("/jobs/{job_id}/approve")
def approve_creative_job(job_id: int, request: Request, db: Session = Depends(get_db)):
    _require_creative_admin(request)
    row = db.query(CreativeContentJob).filter(CreativeContentJob.id == job_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Creative job not found")
    if row.status in {"posted", "winner", "archived"}:
        raise HTTPException(status_code=409, detail="Job is already beyond approval")
    row.status = "approved"
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.post("/jobs/{job_id}/reject")
def reject_creative_job(job_id: int, request: Request, db: Session = Depends(get_db)):
    _require_creative_admin(request)
    row = db.query(CreativeContentJob).filter(CreativeContentJob.id == job_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Creative job not found")
    row.status = "rejected"
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _serialize(row)
