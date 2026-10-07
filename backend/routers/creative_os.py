from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime
import os
import secrets

from backend.db import get_db
from backend.models import CreativeContentJob, CreativeResearchCandidate

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
ALLOWED_RESEARCH_STAGES = {
    "raw",
    "qualified",
    "watched",
    "pattern_confirmed",
    "top3",
    "selected",
    "rejected",
    "stale",
}
ALLOWED_RESEARCH_PLATFORMS = {"instagram", "tiktok", "youtube"}
ALLOWED_RESEARCH_LANES = {"concept", "hook", "format", "adjacent"}
ALLOWED_EVIDENCE_CONFIDENCE = {"low", "medium", "high"}
ALLOWED_PRODUCTION_COMPLEXITY = {"low", "medium", "high"}


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


def _research_creative_total(body: "ResearchCandidateCreate") -> Optional[float]:
    parts = {
        "scroll": _score(body.scroll_stop_score),
        "ninja": _score(body.ninja_fit_score),
        "simplicity": _score(body.simplicity_score),
        "originality": _score(body.originality_score),
        "cost": _score(body.cost_efficiency_score),
        "loop": _score(body.loop_share_score),
        "broad": _score(body.broad_audience_score),
        "brand": _score(body.brand_fit_score),
    }
    if any(v is None for v in parts.values()):
        return None
    total = (
        parts["scroll"] * 0.20
        + parts["ninja"] * 0.20
        + parts["simplicity"] * 0.15
        + parts["originality"] * 0.15
        + parts["cost"] * 0.10
        + parts["loop"] * 0.10
        + parts["broad"] * 0.05
        + parts["brand"] * 0.05
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


class ResearchCandidateCreate(BaseModel):
    candidate_id: str = Field(min_length=3, max_length=100)
    source_key: str = Field(min_length=3, max_length=220)
    platform: str
    lane: str
    stage: str = "raw"

    source_url: str = Field(min_length=8, max_length=4000)
    source_content_id: Optional[str] = Field(default=None, max_length=300)
    source_creator: Optional[str] = Field(default=None, max_length=300)
    source_title: Optional[str] = None
    source_published_at: Optional[datetime] = None

    views: Optional[int] = Field(default=None, ge=0)
    likes: Optional[int] = Field(default=None, ge=0)
    comments: Optional[int] = Field(default=None, ge=0)
    creator_followers: Optional[int] = Field(default=None, ge=0)
    engagement_rate: Optional[float] = Field(default=None, ge=0)
    outlier_score: Optional[float] = Field(default=None, ge=0)
    breakout_score: Optional[float] = Field(default=None, ge=0)
    vph: Optional[float] = Field(default=None, ge=0)

    watched: bool = False
    pattern_key: Optional[str] = Field(default=None, max_length=200)
    pattern_support_count: Optional[int] = Field(default=None, ge=0)
    evidence_confidence: str = "low"
    evidence_notes: Optional[str] = None

    first_frame: Optional[str] = None
    hook_1s: Optional[str] = None
    hook_3s: Optional[str] = None
    camera_notes: Optional[str] = None
    motion_notes: Optional[str] = None
    pacing_notes: Optional[str] = None
    payoff_notes: Optional[str] = None
    loop_notes: Optional[str] = None
    sound_notes: Optional[str] = None

    scroll_stop_score: Optional[float] = None
    ninja_fit_score: Optional[float] = None
    simplicity_score: Optional[float] = None
    originality_score: Optional[float] = None
    cost_efficiency_score: Optional[float] = None
    loop_share_score: Optional[float] = None
    broad_audience_score: Optional[float] = None
    brand_fit_score: Optional[float] = None

    suggested_content_id: Optional[str] = Field(default=None, max_length=80)
    adaptation_title: Optional[str] = Field(default=None, max_length=240)
    adaptation_hook: Optional[str] = None
    adaptation_beat_sheet: Optional[str] = None
    production_route: Optional[str] = Field(default=None, max_length=200)
    production_complexity: Optional[str] = None
    paid_generation_required: Optional[bool] = None
    rejection_reason: Optional[str] = None

    @field_validator("platform")
    @classmethod
    def _platform_ok(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_RESEARCH_PLATFORMS:
            raise ValueError("Unsupported research platform")
        return value

    @field_validator("lane")
    @classmethod
    def _lane_ok(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_RESEARCH_LANES:
            raise ValueError("Unsupported research lane")
        return value

    @field_validator("stage")
    @classmethod
    def _stage_ok(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_RESEARCH_STAGES:
            raise ValueError("Unsupported research stage")
        return value

    @field_validator("evidence_confidence")
    @classmethod
    def _evidence_ok(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_EVIDENCE_CONFIDENCE:
            raise ValueError("Unsupported evidence confidence")
        return value

    @field_validator("production_complexity")
    @classmethod
    def _complexity_ok(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().lower()
        if value not in ALLOWED_PRODUCTION_COMPLEXITY:
            raise ValueError("Unsupported production complexity")
        return value


class ResearchCandidatePatch(BaseModel):
    stage: Optional[str] = None
    evidence_confidence: Optional[str] = None
    watched: Optional[bool] = None
    pattern_support_count: Optional[int] = Field(default=None, ge=0)
    evidence_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    adaptation_title: Optional[str] = None
    adaptation_hook: Optional[str] = None
    adaptation_beat_sheet: Optional[str] = None
    production_route: Optional[str] = None
    production_complexity: Optional[str] = None
    paid_generation_required: Optional[bool] = None

    @field_validator("stage")
    @classmethod
    def _stage_ok(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().lower()
        if value not in ALLOWED_RESEARCH_STAGES:
            raise ValueError("Unsupported research stage")
        return value

    @field_validator("evidence_confidence")
    @classmethod
    def _evidence_ok(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().lower()
        if value not in ALLOWED_EVIDENCE_CONFIDENCE:
            raise ValueError("Unsupported evidence confidence")
        return value

    @field_validator("production_complexity")
    @classmethod
    def _complexity_ok(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().lower()
        if value not in ALLOWED_PRODUCTION_COMPLEXITY:
            raise ValueError("Unsupported production complexity")
        return value


class ResearchBatchCreate(BaseModel):
    candidates: list[ResearchCandidateCreate] = Field(min_length=1, max_length=100)


class ResearchPromoteRequest(BaseModel):
    page: str = "ninja"
    content_id: Optional[str] = Field(default=None, min_length=3, max_length=80)

    @field_validator("page")
    @classmethod
    def _page_ok(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_PAGES:
            raise ValueError("Unsupported page")
        return value


def _validate_research_invariants(
    *,
    stage: str,
    watched: bool,
    pattern_support_count: Optional[int],
) -> None:
    if stage == "watched" and not watched:
        raise HTTPException(status_code=422, detail="watched stage requires watched=true")
    if stage == "pattern_confirmed" and (pattern_support_count or 0) < 3:
        raise HTTPException(
            status_code=422,
            detail="pattern_confirmed requires at least 3 independent supporting examples",
        )


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


def _serialize_research(row: CreativeResearchCandidate) -> dict:
    return {
        "id": row.id,
        "candidate_id": row.candidate_id,
        "source_key": row.source_key,
        "platform": row.platform,
        "lane": row.lane,
        "stage": row.stage,
        "source_url": row.source_url,
        "source_content_id": row.source_content_id,
        "source_creator": row.source_creator,
        "source_title": row.source_title,
        "source_published_at": row.source_published_at.isoformat() if row.source_published_at else None,
        "evidence": {
            "views": row.views,
            "likes": row.likes,
            "comments": row.comments,
            "creator_followers": row.creator_followers,
            "engagement_rate": row.engagement_rate,
            "outlier_score": row.outlier_score,
            "breakout_score": row.breakout_score,
            "vph": row.vph,
            "watched": row.watched,
            "pattern_key": row.pattern_key,
            "pattern_support_count": row.pattern_support_count,
            "confidence": row.evidence_confidence,
            "notes": row.evidence_notes,
        },
        "watch": {
            "first_frame": row.first_frame,
            "hook_1s": row.hook_1s,
            "hook_3s": row.hook_3s,
            "camera": row.camera_notes,
            "motion": row.motion_notes,
            "pacing": row.pacing_notes,
            "payoff": row.payoff_notes,
            "loop": row.loop_notes,
            "sound": row.sound_notes,
        },
        "creative_scores": {
            "scroll_stop": row.scroll_stop_score,
            "ninja_fit": row.ninja_fit_score,
            "simplicity": row.simplicity_score,
            "originality": row.originality_score,
            "cost_efficiency": row.cost_efficiency_score,
            "loop_share": row.loop_share_score,
            "broad_audience": row.broad_audience_score,
            "brand_fit": row.brand_fit_score,
            "total": row.creative_total_score,
        },
        "adaptation": {
            "suggested_content_id": row.suggested_content_id,
            "title": row.adaptation_title,
            "hook": row.adaptation_hook,
            "beat_sheet": row.adaptation_beat_sheet,
            "production_route": row.production_route,
            "complexity": row.production_complexity,
            "paid_generation_required": row.paid_generation_required,
        },
        "rejection_reason": row.rejection_reason,
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


@router.get("/research/summary")
def research_summary(request: Request, db: Session = Depends(get_db)):
    _require_creative_admin(request)
    rows = db.query(CreativeResearchCandidate).all()
    by_stage: dict[str, int] = {}
    by_platform: dict[str, int] = {}
    for row in rows:
        by_stage[row.stage] = by_stage.get(row.stage, 0) + 1
        by_platform[row.platform] = by_platform.get(row.platform, 0) + 1

    top3 = sorted(
        (r for r in rows if r.stage == "top3"),
        key=lambda r: r.creative_total_score or 0.0,
        reverse=True,
    )[:3]
    watched_count = sum(1 for r in rows if r.watched)
    confirmed_patterns = len({
        r.pattern_key
        for r in rows
        if r.pattern_key and (r.pattern_support_count or 0) >= 3
    })
    return {
        "total": len(rows),
        "by_stage": by_stage,
        "by_platform": by_platform,
        "watched": watched_count,
        "confirmed_patterns": confirmed_patterns,
        "top3": [_serialize_research(row) for row in top3],
    }


@router.get("/research")
def list_research_candidates(
    request: Request,
    stage: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    query = db.query(CreativeResearchCandidate)
    if stage:
        stage = stage.strip().lower()
        if stage not in ALLOWED_RESEARCH_STAGES:
            raise HTTPException(status_code=422, detail="Unsupported research stage")
        query = query.filter(CreativeResearchCandidate.stage == stage)
    if platform:
        platform = platform.strip().lower()
        if platform not in ALLOWED_RESEARCH_PLATFORMS:
            raise HTTPException(status_code=422, detail="Unsupported research platform")
        query = query.filter(CreativeResearchCandidate.platform == platform)
    rows = (
        query.order_by(
            CreativeResearchCandidate.creative_total_score.desc(),
            CreativeResearchCandidate.updated_at.desc(),
        )
        .limit(min(max(limit, 1), 500))
        .all()
    )
    return {"candidates": [_serialize_research(row) for row in rows]}


def _upsert_research_candidate(
    body: ResearchCandidateCreate,
    db: Session,
) -> CreativeResearchCandidate:
    _validate_research_invariants(
        stage=body.stage,
        watched=body.watched,
        pattern_support_count=body.pattern_support_count,
    )

    collision = (
        db.query(CreativeResearchCandidate)
        .filter(
            CreativeResearchCandidate.candidate_id == body.candidate_id,
            CreativeResearchCandidate.source_key != body.source_key,
        )
        .first()
    )
    if collision:
        raise HTTPException(status_code=409, detail="candidate_id already belongs to another source")

    row = (
        db.query(CreativeResearchCandidate)
        .filter(CreativeResearchCandidate.source_key == body.source_key)
        .first()
    )
    values = body.model_dump()
    score_keys = (
        "scroll_stop_score",
        "ninja_fit_score",
        "simplicity_score",
        "originality_score",
        "cost_efficiency_score",
        "loop_share_score",
        "broad_audience_score",
        "brand_fit_score",
    )
    normalized_scores = {key: _score(values.pop(key, None)) for key in score_keys}
    creative_total = _research_creative_total(body)

    if row:
        for key, value in values.items():
            setattr(row, key, value)
        for key, value in normalized_scores.items():
            setattr(row, key, value)
        row.creative_total_score = creative_total
        row.updated_at = datetime.utcnow()
        return row

    row = CreativeResearchCandidate(
        **values,
        **normalized_scores,
        creative_total_score=creative_total,
    )
    db.add(row)
    return row


@router.post("/research/batch")
def upsert_research_batch(
    request: Request,
    body: ResearchBatchCreate,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    rows: list[CreativeResearchCandidate] = []
    try:
        for candidate in body.candidates:
            rows.append(_upsert_research_candidate(candidate, db))
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Research candidate uniqueness conflict") from exc

    for row in rows:
        db.refresh(row)
    return {"upserted": len(rows), "candidates": [_serialize_research(row) for row in rows]}


@router.patch("/research/{candidate_id}")
def patch_research_candidate(
    candidate_id: int,
    request: Request,
    body: ResearchCandidatePatch,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    row = (
        db.query(CreativeResearchCandidate)
        .filter(CreativeResearchCandidate.id == candidate_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Research candidate not found")

    values = body.model_dump(exclude_unset=True)
    next_stage = values.get("stage", row.stage)
    next_watched = values.get("watched", row.watched)
    next_support = values.get("pattern_support_count", row.pattern_support_count)
    _validate_research_invariants(
        stage=next_stage,
        watched=next_watched,
        pattern_support_count=next_support,
    )

    for key, value in values.items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _serialize_research(row)


@router.post("/research/{candidate_id}/reject")
def reject_research_candidate(
    candidate_id: int,
    request: Request,
    body: ResearchCandidatePatch,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    row = (
        db.query(CreativeResearchCandidate)
        .filter(CreativeResearchCandidate.id == candidate_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Research candidate not found")
    row.stage = "rejected"
    if body.rejection_reason is not None:
        row.rejection_reason = body.rejection_reason
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _serialize_research(row)


@router.post("/research/{candidate_id}/promote")
def promote_research_candidate(
    candidate_id: int,
    request: Request,
    body: ResearchPromoteRequest,
    db: Session = Depends(get_db),
):
    _require_creative_admin(request)
    research = (
        db.query(CreativeResearchCandidate)
        .filter(CreativeResearchCandidate.id == candidate_id)
        .first()
    )
    if not research:
        raise HTTPException(status_code=404, detail="Research candidate not found")
    if research.stage == "rejected":
        raise HTTPException(status_code=409, detail="Rejected research candidate cannot be promoted")

    page_code = {"ninja": "N", "brand": "B", "media": "M"}[body.page]
    content_id = (
        body.content_id
        or research.suggested_content_id
        or f"EN-{page_code}-R{research.id:04d}"
    )

    existing = (
        db.query(CreativeContentJob)
        .filter(CreativeContentJob.content_id == content_id)
        .first()
    )
    if existing:
        research.stage = "selected"
        research.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(research)
        return {"research": _serialize_research(research), "job": _serialize(existing)}

    job_body = CreativeJobCreate(
        content_id=content_id,
        page=body.page,
        status="approved",
        title=research.adaptation_title or research.source_title or research.candidate_id,
        reference_url=research.source_url,
        reference_notes=(
            f"Research {research.candidate_id}; evidence={research.evidence_confidence}; "
            f"pattern_support={research.pattern_support_count or 0}; watched={research.watched}"
        ),
        format_type=research.pattern_key or research.lane,
        source=research.platform,
        hook=research.adaptation_hook,
        beat_sheet=research.adaptation_beat_sheet,
        virality_score=research.scroll_stop_score,
        ninja_fit_score=research.ninja_fit_score,
        simplicity_score=research.simplicity_score,
        originality_score=research.originality_score,
        cost_efficiency_score=research.cost_efficiency_score,
        brand_fit_score=research.brand_fit_score,
        agent_note=(
            f"Promoted from research candidate {research.candidate_id}. "
            f"Recommended production route: {research.production_route or 'not set'}."
        ),
    )
    values = job_body.model_dump()
    for score_key in (
        "virality_score",
        "ninja_fit_score",
        "simplicity_score",
        "originality_score",
        "cost_efficiency_score",
        "brand_fit_score",
    ):
        values.pop(score_key, None)

    job = CreativeContentJob(
        **values,
        virality_score=_score(job_body.virality_score),
        ninja_fit_score=_score(job_body.ninja_fit_score),
        simplicity_score=_score(job_body.simplicity_score),
        originality_score=_score(job_body.originality_score),
        cost_efficiency_score=_score(job_body.cost_efficiency_score),
        brand_fit_score=_score(job_body.brand_fit_score),
        total_score=_weighted_total(job_body),
    )
    db.add(job)
    research.stage = "selected"
    research.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    db.refresh(research)
    return {"research": _serialize_research(research), "job": _serialize(job)}
