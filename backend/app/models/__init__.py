"""Every model, imported once.

Alembic's autogenerate and the test harness both need every table registered
on ``Base.metadata``; importing this package is what does it.
"""

from app.db.base import Base
from app.models.account import (
    AccountProfile,
    AccountSettings,
    RecoveryCode,
    default_notifications,
    default_privacy,
)
from app.models.analytics import LinkClick, PageView
from app.models.asset import Asset
from app.models.auth_session import AuthSession
from app.models.portfolio import Portfolio, PortfolioHeader, Section, default_layout
from app.models.user import User

__all__ = [
    "AccountProfile",
    "AccountSettings",
    "Asset",
    "AuthSession",
    "Base",
    "LinkClick",
    "PageView",
    "Portfolio",
    "PortfolioHeader",
    "RecoveryCode",
    "Section",
    "User",
    "default_layout",
    "default_notifications",
    "default_privacy",
]
