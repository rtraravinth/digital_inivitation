"""Reading and updating everything on /account that is not a portfolio."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dns_lookup import DnsLookup
from app.core.errors import Conflict, NotFound, ValidationFailed
from app.models import AccountProfile, AccountSettings, Asset, User
from app.schemas.account import (
    RESERVED_SUBDOMAINS,
    AccountOut,
    DomainPatch,
    DomainSetupOut,
    NotificationsPatch,
    PlanPatch,
    PrivacyPatch,
    ProfileOut,
    ProfilePatch,
    SecurityOut,
    SecurityPatch,
)
from app.schemas.asset import asset_out
from app.services import domains
from app.services.asset import AssetService


async def assert_subdomain_available(
    session: AsyncSession, subdomain: str, *, exclude_user_id: uuid.UUID | None = None
) -> None:
    """Raise unless ``subdomain`` is free to claim.

    Registration and a later rename both land here, so the reserved list and
    the uniqueness rule cannot drift apart between them.
    """
    if subdomain in RESERVED_SUBDOMAINS:
        raise Conflict(
            "That address is reserved.", code="subdomain_reserved", details={"subdomain": subdomain}
        )

    query = select(AccountProfile).where(AccountProfile.subdomain == subdomain)
    if exclude_user_id is not None:
        query = query.where(AccountProfile.user_id != exclude_user_id)
    if await session.scalar(query) is not None:
        raise Conflict(
            "That subdomain is already taken.",
            code="subdomain_taken",
            details={"subdomain": subdomain},
        )


class AccountService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user: User, *, routing_ok: bool | None = None) -> AccountOut:
        profile = user.profile
        settings = user.settings

        return AccountOut(
            profile=ProfileOut(
                name=profile.name,
                subdomain=profile.subdomain,
                current=profile.current,
                about=profile.about,
                tags=list(profile.tags or []),
                links=list(profile.links or []),
                portrait=asset_out(profile.portrait),
            ),
            security=SecurityOut(
                email=user.email,
                phone=settings.phone,
                google=settings.google_linked,
                sign_in_provider=settings.sign_in_provider,
            ),
            plan=settings.plan,
            custom_domain=settings.custom_domain,
            domain_setup=_domain_setup(user.id, settings, routing_ok),
            notifications=dict(settings.notifications or {}),
            privacy=dict(settings.privacy or {}),
        )

    # ── profile ─────────────────────────────────────────────────────────

    async def update_profile(self, user: User, patch: ProfilePatch) -> AccountOut:
        profile = user.profile

        if patch.subdomain is not None and patch.subdomain != profile.subdomain:
            await self._assert_subdomain_free(patch.subdomain, user.id)
            profile.subdomain = patch.subdomain

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

    async def _assert_subdomain_free(self, subdomain: str, user_id: uuid.UUID) -> None:
        await assert_subdomain_available(self.session, subdomain, exclude_user_id=user_id)

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
        domain = patch.custom_domain
        if domain and domains.is_ours(domain):
            raise ValidationFailed(
                "That is one of ours — your subdomain already serves your pages there.",
                code="domain_reserved",
                details={"customDomain": domain},
            )
        if domain != user.settings.custom_domain:
            # A new domain is proved from scratch: its token differs, and the
            # old proof says nothing about it.
            user.settings.custom_domain = domain
            user.settings.custom_domain_verified_at = None
        await self.session.flush()
        return await self.get(user)

    async def verify_domain(self, user: User, lookup: DnsLookup) -> AccountOut:
        """Look the records up, and verify the domain if its TXT record is there."""
        settings = user.settings
        domain = settings.custom_domain
        if not domain or domains.records(user.id, domain) is None:
            raise NotFound("There is no domain to check.", code="no_domain")

        owned, routed = await domains.check(lookup, user.id, domain)
        if owned:
            holder = await self.session.scalar(
                select(AccountSettings.user_id).where(
                    AccountSettings.custom_domain == domain,
                    AccountSettings.custom_domain_verified_at.is_not(None),
                    AccountSettings.user_id != user.id,
                )
            )
            if holder is not None:
                raise Conflict(
                    "Another account has already verified that domain.",
                    code="domain_taken",
                    details={"customDomain": domain},
                )
            if settings.custom_domain_verified_at is None:
                settings.custom_domain_verified_at = datetime.now(UTC)
        else:
            # The proof is gone or never arrived; the domain stops serving.
            settings.custom_domain_verified_at = None
        await self.session.flush()
        return await self.get(user, routing_ok=routed)

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


def _domain_setup(
    user_id: uuid.UUID, settings: AccountSettings, routing_ok: bool | None
) -> DomainSetupOut | None:
    domain = settings.custom_domain
    records = domains.records(user_id, domain) if domain else None
    if records is None:
        return None
    return DomainSetupOut(
        domain=domain,
        verified=settings.custom_domain_verified_at is not None,
        verified_at=settings.custom_domain_verified_at,
        records=records,
        routing_ok=routing_ok,
    )
