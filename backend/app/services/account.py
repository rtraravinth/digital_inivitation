"""Reading and updating everything on /account that is not a portfolio."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.models import AccountProfile, Asset, RecoveryCode, User
from app.schemas.account import (
    AccountOut,
    DomainPatch,
    NotificationsPatch,
    PlanPatch,
    PrivacyPatch,
    ProfileOut,
    ProfilePatch,
    SecurityOut,
    SecurityPatch,
)
from app.schemas.asset import asset_out
from app.services.asset import AssetService


class AccountService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user: User) -> AccountOut:
        remaining = await self._unused_recovery_codes(user)
        profile = user.profile
        settings = user.settings

        return AccountOut(
            profile=ProfileOut(
                name=profile.name,
                handle=profile.handle,
                current=profile.current,
                about=profile.about,
                tags=list(profile.tags or []),
                links=list(profile.links or []),
                portrait=asset_out(profile.portrait),
            ),
            security=SecurityOut(
                email=user.email,
                phone=settings.phone,
                password_changed=settings.password_changed_at,
                two_step=settings.two_step_enabled,
                google=settings.google_linked,
                recovery_codes_remaining=remaining,
            ),
            plan=settings.plan,
            custom_domain=settings.custom_domain,
            notifications=dict(settings.notifications or {}),
            privacy=dict(settings.privacy or {}),
        )

    async def _unused_recovery_codes(self, user: User) -> int:
        rows = await self.session.scalars(
            select(RecoveryCode).where(
                RecoveryCode.user_id == user.id, RecoveryCode.used_at.is_(None)
            )
        )
        return len(list(rows))

    # ── profile ─────────────────────────────────────────────────────────

    async def update_profile(self, user: User, patch: ProfilePatch) -> AccountOut:
        profile = user.profile

        if patch.handle is not None and patch.handle != profile.handle:
            await self._assert_handle_free(patch.handle, user.id)
            profile.handle = patch.handle

        for field in ("name", "current", "about"):
            value = getattr(patch, field)
            if value is not None:
                setattr(profile, field, value)

        if patch.tags is not None:
            profile.tags = list(patch.tags)
        if patch.links is not None:
            profile.links = [link.model_dump(by_alias=True) for link in patch.links]

        portrait_changed = patch.clear_portrait or patch.portrait_asset_id is not None
        replaced = profile.portrait_asset_id if portrait_changed else None
        if patch.clear_portrait:
            profile.portrait_asset_id = None
        elif patch.portrait_asset_id is not None:
            await self._assert_owns_asset(user, patch.portrait_asset_id)
            profile.portrait_asset_id = patch.portrait_asset_id

        await self.session.flush()
        if replaced is not None and replaced != profile.portrait_asset_id:
            await AssetService(self.session).release(replaced)
        # Reload the relationship here rather than letting it lazy-load during
        # response serialisation, where awaiting is not possible.
        await self.session.refresh(profile, ["portrait"] if portrait_changed else None)
        return await self.get(user)

    async def _assert_handle_free(self, handle: str, user_id: uuid.UUID) -> None:
        taken = await self.session.scalar(
            select(AccountProfile).where(
                AccountProfile.handle == handle, AccountProfile.user_id != user_id
            )
        )
        if taken is not None:
            raise Conflict(
                "That handle is already taken.", code="handle_taken", details={"handle": handle}
            )

    async def _assert_owns_asset(self, user: User, asset_id: uuid.UUID) -> Asset:
        asset = await self.session.scalar(
            select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id)
        )
        if asset is None:
            # Someone else's asset id is "not found", never "forbidden".
            raise NotFound("That upload does not exist.", code="asset_not_found")
        return asset

    # ── settings ────────────────────────────────────────────────────────

    async def update_security(self, user: User, patch: SecurityPatch) -> AccountOut:
        if patch.phone is not None:
            user.settings.phone = patch.phone
        if patch.google is not None:
            user.settings.google_linked = patch.google
        await self.session.flush()
        return await self.get(user)

    async def set_plan(self, user: User, patch: PlanPatch) -> AccountOut:
        # Stored, and enforcing nothing: there is no payment processor. The
        # Account page says so on screen rather than implying otherwise.
        user.settings.plan = patch.plan
        await self.session.flush()
        return await self.get(user)

    async def set_domain(self, user: User, patch: DomainPatch) -> AccountOut:
        # Likewise stored and inert: serving a domain needs DNS and a host.
        user.settings.custom_domain = patch.custom_domain
        await self.session.flush()
        return await self.get(user)

    async def update_notifications(self, user: User, patch: NotificationsPatch) -> AccountOut:
        user.settings.notifications = self._merge(
            user.settings.notifications, patch.model_dump(by_alias=True, exclude_none=True)
        )
        await self.session.flush()
        return await self.get(user)

    async def update_privacy(self, user: User, patch: PrivacyPatch) -> AccountOut:
        user.settings.privacy = self._merge(
            user.settings.privacy, patch.model_dump(by_alias=True, exclude_none=True)
        )
        await self.session.flush()
        return await self.get(user)

    @staticmethod
    def _merge(current: dict[str, bool] | None, changes: dict[str, bool]) -> dict[str, bool]:
        # A new dict, not a mutation: SQLAlchemy does not track in-place
        # changes to a JSONB value and the update would silently not persist.
        return {**(current or {}), **changes}

    # ── the whole account ───────────────────────────────────────────────

    async def delete_account(self, user: User) -> list[str]:
        """Delete the user. Returns the storage keys left to clean up.

        Rows go by cascade; the files behind them are not the database's to
        remove, so the caller deletes them once the transaction has committed.
        """
        assets = await self.session.scalars(select(Asset).where(Asset.user_id == user.id))
        keys = [asset.storage_key for asset in assets]

        await self.session.delete(user)
        await self.session.flush()
        return keys
