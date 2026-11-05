"""Sections: add, edit, reorder, remove.

Positions are kept dense (0..n-1) inside every write, so no sequence of edits
can leave a gap or a duplicate for a later reorder to trip over.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFound, ValidationFailed
from app.models import Asset, Portfolio, Section, SectionImage
from app.models.enums import DEFAULT_TAB
from app.schemas.section import SectionOrder, SectionPatch
from app.services.asset import AssetService


def first_tab(portfolio: Portfolio) -> str:
    """The tab a new section files under.

    Whatever the page already uses, so adding a section does not silently open
    a tab of its own; ``DEFAULT_TAB`` only for a page with no sections yet.
    """
    for section in sorted(portfolio.sections, key=lambda s: s.position):
        if section.tab.strip():
            return section.tab
    return DEFAULT_TAB


class SectionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, portfolio: Portfolio) -> Section:
        section = Section(
            portfolio_id=portfolio.id,
            position=len(portfolio.sections),
            tab=first_tab(portfolio),
            links=[],
        )
        self.session.add(section)
        await self._normalise(portfolio)
        return section

    async def get(self, portfolio: Portfolio, section_id: uuid.UUID) -> Section:
        section = await self.session.scalar(
            select(Section).where(
                Section.id == section_id, Section.portfolio_id == portfolio.id
            )
        )
        if section is None:
            raise NotFound("That section does not exist.", code="section_not_found")
        return section

    async def update(
        self, portfolio: Portfolio, section_id: uuid.UUID, patch: SectionPatch
    ) -> Section:
        section = await self.get(portfolio, section_id)
        provided = patch.model_fields_set

        for field in ("title", "description", "tab", "hidden", "on_resume"):
            value = getattr(patch, field)
            if value is not None:
                setattr(section, field, value)

        for field in ("links", "blocks"):
            value = getattr(patch, field)
            if value is not None:
                setattr(section, field, _dump_list(value))

        # Absent leaves the quote alone; an explicit null clears it. Only
        # model_fields_set can tell those two apart.
        if "quote" in provided:
            section.quote = patch.quote.model_dump(by_alias=True) if patch.quote else None

        if patch.image_asset_ids is not None:
            await self._apply_images(section, portfolio, patch.image_asset_ids)
        await self._apply_attachment(
            section, portfolio, "file_asset_id", patch.file_asset_id, patch.clear_file
        )

        await self.session.flush()
        await self.session.refresh(section)
        await self.session.refresh(section, ["images"])
        return section

    async def _apply_images(
        self, section: Section, portfolio: Portfolio, asset_ids: list[uuid.UUID]
    ) -> None:
        """Replace the section's pictures with ``asset_ids``, in that order.

        A repeated id is kept once, at its first position. Every id must be
        the caller's own upload; any picture that drops out of the list is
        released, so it does not outlive the last place it was shown.
        """
        wanted = list(dict.fromkeys(asset_ids))
        if wanted:
            owned = set(
                await self.session.scalars(
                    select(Asset.id).where(
                        Asset.id.in_(wanted), Asset.user_id == portfolio.user_id
                    )
                )
            )
            if len(owned) != len(wanted):
                raise NotFound("That upload does not exist.", code="asset_not_found")

        dropped = [image.asset_id for image in section.images if image.asset_id not in wanted]
        # Clear first and flush, so the new positions never collide with the
        # old rows under the (section, position) unique constraint.
        section.images.clear()
        await self.session.flush()
        section.images.extend(
            SectionImage(asset_id=asset_id, position=index)
            for index, asset_id in enumerate(wanted)
        )
        await self.session.flush()

        assets = AssetService(self.session)
        for asset_id in dropped:
            await assets.release(asset_id)

    async def _apply_attachment(
        self,
        section: Section,
        portfolio: Portfolio,
        field: str,
        asset_id: uuid.UUID | None,
        clear: bool,
    ) -> None:
        replaced = getattr(section, field)

        if clear:
            setattr(section, field, None)
            await AssetService(self.session).release(replaced)
            return
        if asset_id is None:
            return

        owns = await self.session.scalar(
            select(Asset).where(Asset.id == asset_id, Asset.user_id == portfolio.user_id)
        )
        if owns is None:
            # Another user's asset id is "not found", never "forbidden".
            raise NotFound("That upload does not exist.", code="asset_not_found")
        setattr(section, field, asset_id)
        if replaced is not None and replaced != asset_id:
            await AssetService(self.session).release(replaced)

    async def delete(self, portfolio: Portfolio, section_id: uuid.UUID) -> None:
        section = await self.get(portfolio, section_id)
        await self.session.delete(section)
        await self._normalise(portfolio)

    async def move(self, portfolio: Portfolio, section_id: uuid.UUID, delta: int) -> None:
        sections = await self._ordered(portfolio)
        index = next(
            (i for i, section in enumerate(sections) if section.id == section_id), None
        )
        if index is None:
            raise NotFound("That section does not exist.", code="section_not_found")

        target = index + delta
        if target < 0 or target >= len(sections):
            # At a boundary the up/down buttons do nothing. That is not a
            # client error, so it is not an error response.
            return

        sections[index], sections[target] = sections[target], sections[index]
        await self._write_order(sections)
        await self._normalise(portfolio)

    async def reorder(self, portfolio: Portfolio, payload: SectionOrder) -> None:
        sections = await self._ordered(portfolio)
        by_id = {section.id: section for section in sections}

        if set(payload.ids) != set(by_id) or len(payload.ids) != len(sections):
            # A partial list would silently drop whatever it omitted.
            raise ValidationFailed(
                "That list does not match this portfolio's sections.",
                code="section_order_mismatch",
                details={"expected": len(sections), "received": len(payload.ids)},
            )

        await self._write_order([by_id[section_id] for section_id in payload.ids])
        await self._normalise(portfolio)

    async def _ordered(self, portfolio: Portfolio) -> list[Section]:
        rows = await self.session.scalars(
            select(Section)
            .where(Section.portfolio_id == portfolio.id)
            .order_by(Section.position, Section.created_at)
        )
        return list(rows)

    async def _write_order(self, sections: list[Section]) -> None:
        # Two passes through a disjoint range first, so the unique-ish
        # (portfolio, position) space never collides mid-update.
        for offset, section in enumerate(sections):
            section.position = 10_000 + offset
        await self.session.flush()

        for offset, section in enumerate(sections):
            section.position = offset
        await self.session.flush()

    async def _normalise(self, portfolio: Portfolio) -> None:
        # The session runs with autoflush off, so a pending insert or delete
        # would be invisible to the query below and the positions it wrote
        # would be computed from a stale row set.
        await self.session.flush()

        sections = await self._ordered(portfolio)
        for offset, section in enumerate(sections):
            if section.position != offset:
                section.position = offset
        await self.session.flush()
        await self.session.refresh(portfolio)
        await reload_sections(self.session, portfolio)


async def reload_sections(session: AsyncSession, portfolio: Portfolio) -> None:
    """Load every section's pictures afresh.

    ``refresh(portfolio)`` repopulates the sections themselves but resets the
    collections hanging off sections it already held, and an unloaded
    collection read later would be IO outside the event loop's reach.
    """
    await session.execute(
        select(Section)
        .where(Section.portfolio_id == portfolio.id)
        .options(selectinload(Section.images).selectinload(SectionImage.asset))
        .execution_options(populate_existing=True)
    )


def _dump_list(values: list) -> list:
    return [item.model_dump(by_alias=True) if hasattr(item, "model_dump") else item
            for item in values]
