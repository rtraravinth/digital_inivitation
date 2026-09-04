"""Sections: add, edit, reorder, remove.

Positions are kept dense (0..n-1) inside every write, so no sequence of edits
can leave a gap or a duplicate for a later reorder to trip over.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound, ValidationFailed
from app.models import Asset, Portfolio, Section
from app.models.enums import BlockKind
from app.schemas.section import SectionOrder, SectionPatch
from app.services.asset import AssetService

#: The add-block picker's starting titles, matching KIND_TITLE in
#: src/lib/store.tsx. A kind only chooses the glyph and this first line —
#: every block is still the same four fields underneath.
KIND_TITLE: dict[str, str] = {
    "link": "",
    "venture": "A business you run",
    "contact": "How to reach you",
    "booking": "Book a time",
    "testimonial": "What a client said",
    "gallery": "Photographs",
    "numbers": "By the numbers",
    "document": "A document to download",
}


class SectionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, portfolio: Portfolio, kind: BlockKind = "link") -> Section:
        section = Section(
            portfolio_id=portfolio.id,
            position=len(portfolio.sections),
            title=KIND_TITLE.get(kind, ""),
            kind=kind,
            tags=[],
            links=[],
            numbers=[],
            dates=[],
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

        for field in ("title", "description", "hidden", "kind"):
            value = getattr(patch, field)
            if value is not None:
                setattr(section, field, value)

        for field in ("tags", "links", "numbers", "dates"):
            value = getattr(patch, field)
            if value is not None:
                setattr(section, field, _dump_list(value))

        # Absent leaves the quote alone; an explicit null clears it. Only
        # model_fields_set can tell those two apart.
        if "quote" in provided:
            section.quote = patch.quote.model_dump(by_alias=True) if patch.quote else None

        await self._apply_attachment(
            section, portfolio, "image_asset_id", patch.image_asset_id, patch.clear_image
        )
        await self._apply_attachment(
            section, portfolio, "file_asset_id", patch.file_asset_id, patch.clear_file
        )

        await self.session.flush()
        await self.session.refresh(section)
        return section

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


def _dump_list(values: list) -> list:
    return [item.model_dump(by_alias=True) if hasattr(item, "model_dump") else item
            for item in values]
