from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.models.schemas import UserProfile, PricingPlan

router = APIRouter(prefix="/auth", tags=["Auth & User"])

# Default in-memory profile
CURRENT_USER = UserProfile(
    id="usr_88291a",
    email="creator@cleanframe.ai",
    name="Alex Sterling",
    avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    plan="Pro",
    credits_remaining=25,
    credits_total=50,
    created_at="2026-01-15",
    is_authenticated=True
)

class LoginRequest(BaseModel):
    email: str
    password: str

class PlanChangeRequest(BaseModel):
    plan_name: str

PRICING_PLANS: List[PricingPlan] = [
    PricingPlan(
        id="free",
        name="Free Tier",
        price_monthly=0,
        credits=5,
        max_video_duration_sec=15,
        max_resolution="1080p",
        features=[
            "5 media restorations / mo",
            "Image watermark cleaner",
            "Basic text detection",
            "Standard export resolution (1080p)",
            "Web interface access"
        ],
        is_popular=False
    ),
    PricingPlan(
        id="pro",
        name="Pro Creator",
        price_monthly=29,
        credits=150,
        max_video_duration_sec=60,
        max_resolution="4K Ultra",
        features=[
            "150 high-res restorations / mo",
            "Both Image & Video inpainting",
            "Intelligent Instagram & Reels AI detector",
            "Temporal consistency anti-flicker",
            "Audio stream preservation",
            "Batch media processing",
            "Full 4K export quality",
            "Priority GPU compute queue"
        ],
        is_popular=True
    ),
    PricingPlan(
        id="enterprise",
        name="Studio / Enterprise",
        price_monthly=99,
        credits=1000,
        max_video_duration_sec=300,
        max_resolution="Original 8K",
        features=[
            "Unlimited image cleaning",
            "1,000 video restoration minutes",
            "Custom logo & watermark training",
            "Full REST API & Webhook access",
            "On-premise / private cloud deploy option",
            "Dedicated support engineer & SLA"
        ],
        is_popular=False
    )
]

@router.get("/me", response_model=UserProfile)
async def get_current_user():
    return CURRENT_USER

@router.post("/login", response_model=UserProfile)
async def login(req: LoginRequest):
    CURRENT_USER.email = req.email
    CURRENT_USER.name = req.email.split("@")[0].capitalize() or "User"
    CURRENT_USER.is_authenticated = True
    return CURRENT_USER

@router.post("/register", response_model=UserProfile)
async def register(req: LoginRequest):
    CURRENT_USER.email = req.email
    CURRENT_USER.name = req.email.split("@")[0].capitalize() or "New Creator"
    CURRENT_USER.is_authenticated = True
    CURRENT_USER.credits_remaining = 25
    return CURRENT_USER

@router.post("/logout")
async def logout():
    CURRENT_USER.is_authenticated = False
    return {"message": "Logged out successfully"}

@router.post("/upgrade")
async def change_plan(req: PlanChangeRequest):
    valid_plans = ["Free", "Pro", "Enterprise"]
    if req.plan_name in valid_plans:
        CURRENT_USER.plan = req.plan_name
        if req.plan_name == "Free":
            CURRENT_USER.credits_remaining = 5
        elif req.plan_name == "Pro":
            CURRENT_USER.credits_remaining = 150
        elif req.plan_name == "Enterprise":
            CURRENT_USER.credits_remaining = 1000
    return CURRENT_USER

@router.get("/pricing", response_model=List[PricingPlan])
async def get_pricing():
    return PRICING_PLANS
