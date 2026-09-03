"""Every v1 router, mounted under one prefix."""

from fastapi import APIRouter

from app.api.v1 import account, auth, portfolios, sections

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(account.router)
api_router.include_router(portfolios.router)
api_router.include_router(sections.router)
