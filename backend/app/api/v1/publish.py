"""The public surface: what an unauthenticated visitor can reach.

No token, and no way to reach anything unpublished. The owner's privacy
switches are applied here, on the server, so turning one off removes data
from the response rather than hiding it in the page.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.api.route import TransactionRoute
from app.api.v1.assets import serve
from app.core.errors import NotFound
from app.core.ratelimit import LINK_CLICK, PAGE_VIEW, allowed
from app.models import (
    AccountProfile,
    AccountSettings,
    Asset,
    Portfolio,
    PortfolioHeader,
    Section,
    SectionImage,
)
from app.schemas.common import ERROR_RESPONSES
from app.schemas.portfolio import Layout
from app.schemas.publish import (
    DomainOwnerOut,
    PublicPortfolioOut,
    RecordClickRequest,
    RecordViewRequest,
)
from app.schemas.resume import (
    PublicResume,
    PublicResumeHeader,
    PublicResumeOut,
    resume_from_stored,
)
from app.services.analytics import AnalyticsService
from app.services.ats import LISTS, prints_on_resume
from app.services.portfolio import footer_out, header_out, section_out

router = APIRouter(
    prefix="/public",
    tags=["public"],
    responses=ERROR_RESPONSES,
    route_class=TransactionRoute,
)


async def _load_published(
    session: SessionDep, subdomain: str, slug: str, *, resume: bool = False
) -> tuple[Portfolio, dict]:
    """The published portfolio at ``<subdomain>/<slug>`` and its privacy switches.

    One query with eager loads: a published page must not issue a query per
    section. The subdomain is joined rather than looked up first, so a wrong
    subdomain is the same 404 as a wrong slug — neither confirms the other.
    """
    portfolio = await session.scalar(
        select(Portfolio)
        .join(AccountProfile, AccountProfile.user_id == Portfolio.user_id)
        .where(
            AccountProfile.subdomain == subdomain.lower(),
            Portfolio.slug == slug,
            (Portfolio.resume_status if resume else Portfolio.status) == "live",
        )
        .options(
            selectinload(Portfolio.header),
            selectinload(Portfolio.sections)
            .selectinload(Section.images)
            .selectinload(SectionImage.asset),
        )
    )
    if portfolio is None:
        # Draft and non-existent are the same answer: a draft's existence is
        # not a visitor's business.
        raise NotFound("There is no page at that address.", code="page_not_found")

    settings = await session.scalar(
        select(AccountSettings).where(AccountSettings.user_id == portfolio.user_id)
    )
    return portfolio, dict(settings.privacy or {}) if settings else {}


@router.get(
    "/domains/{domain}",
    response_model=DomainOwnerOut,
    summary="Whose verified custom domain this is",
    description=(
        "The subdomain whose pages a custom domain serves. 404 unless an "
        "account has verified the domain and holds a subdomain."
    ),
)
async def read_domain_owner(domain: str, session: SessionDep) -> DomainOwnerOut:
    subdomain = await session.scalar(
        select(AccountProfile.subdomain)
        .join(AccountSettings, AccountSettings.user_id == AccountProfile.user_id)
        .where(
            AccountSettings.custom_domain == domain.lower().rstrip("."),
            AccountSettings.custom_domain_verified_at.is_not(None),
            AccountProfile.subdomain.is_not(None),
        )
    )
    if subdomain is None:
        raise NotFound("There is no page at that address.", code="page_not_found")
    return DomainOwnerOut(subdomain=subdomain)


@router.get(
    "/p/{subdomain}/{slug}",
    response_model=PublicPortfolioOut,
    summary="Read a published page",
)
async def read_published(subdomain: str, slug: str, session: SessionDep, response: Response):
    portfolio, privacy = await _load_published(session, subdomain, slug)

    indexable = privacy.get("indexable", True)
    show_contact = privacy.get("showContact", True)
    badge = privacy.get("badge", True)

    if not indexable:
        # The page still opens for anyone with the link; it just asks not to
        # be indexed, which is what the switch promises.
        response.headers["X-Robots-Tag"] = "noindex, nofollow"

    return PublicPortfolioOut(
        id=portfolio.id,
        name=portfolio.name,
        slug=portfolio.slug,
        theme=portfolio.theme,
        accent=portfolio.accent,
        ground=portfolio.ground,
        ground_hex=portfolio.ground_hex,
        font=portfolio.font,
        body_font=portfolio.body_font,
        layout=Layout.model_validate(portfolio.layout),
        header=header_out(portfolio.header, public=True, links=show_contact),
        footer=footer_out(portfolio.footer, links=show_contact),
        # Hidden sections never reach a visitor, whatever the theme does.
        sections=[
            section_out(section, public=True, contact=show_contact)
            for section in portfolio.sections
            if not section.hidden
        ],
        # The lists travel inside the sections above, in their components.
        resume=PublicResume(),
        published_at=portfolio.published_at,
        noindex=not indexable,
        badge=badge,
        show_contact=show_contact,
    )


def _ticked_contact(block, ticks):
    """A contact component with the details the owner left unticked blanked."""
    if block.type != "contact":
        return block
    blank = {f: "" for f in ("email", "phone", "location") if not getattr(ticks, f)}
    return block.model_copy(update=blank)


def _is_address(url: str, scheme: str, own: str) -> bool:
    """A link that is, or points at, an email (``mailto:``) or phone (``tel:``)."""
    lowered = url.strip().lower()
    return lowered.startswith(scheme) or (bool(own.strip()) and lowered == own.strip().lower())


def _without_unticked_addresses(links, ticks, resume):
    """Links minus any that carry an email or phone the owner left unticked."""
    kept = []
    for link in links:
        if not ticks.email and _is_address(link.url, "mailto:", resume.email):
            continue
        if not ticks.phone and _is_address(link.url, "tel:", resume.phone):
            continue
        kept.append(link)
    return kept


def _public_resume_out(portfolio: Portfolio, subdomain: str) -> PublicResumeOut:
    resume = resume_from_stored(portfolio.resume)
    ticks = resume.public_contact
    # Compare links with the owner's own values, before they are blanked.
    own = resume.model_copy()
    # An unticked detail is blanked, not hidden: it must not be in the body.
    for field in ("email", "phone", "location", "website"):
        if not getattr(ticks, field):
            setattr(resume, field, "")
    hidden = set(resume.hidden)
    sections = []
    placed: set[str] = set()
    for section in portfolio.sections:
        if not section.on_resume:
            continue
        out = section_out(section, public=True)
        out.blocks = [
            _ticked_contact(b, ticks)
            for b in out.blocks
            if prints_on_resume(b.model_dump(by_alias=True), hidden)
        ]
        kinds = {b.type for b in out.blocks}
        placed.update(kinds)
        # The Text, Links and Quote components only place the section's own
        # fields, so a field leaves only while its component prints.
        if "text" not in kinds:
            out.description = ""
        if "links" not in kinds:
            out.links = []
        if "quote" not in kinds:
            out.quote = None
        out.links = _without_unticked_addresses(out.links, ticks, own)
        for i, b in enumerate(out.blocks):
            if b.type == "contact" and b.cta_url:
                gone = (not ticks.email and _is_address(b.cta_url, "mailto:", own.email)) or (
                    not ticks.phone and _is_address(b.cta_url, "tel:", own.phone)
                )
                if gone:
                    out.blocks[i] = b.model_copy(update={"cta_url": "", "cta_label": ""})
        # The resume prints no pictures and a section here is never "hidden".
        out.images = []
        out.hidden = False
        sections.append(out)
    # Entries travel in the printing components above; the resume's own
    # lists (what it held before entries moved into components) never leave.
    for kind in LISTS:
        setattr(resume, kind, [])
    header = header_out(portfolio.header, public=True, links=True)
    # The website tick covers the header's links, except an address the owner
    # unticked, which goes whichever way the website tick is set.
    header_links = _without_unticked_addresses(header.links, ticks, own) if ticks.website else []
    return PublicResumeOut(
        name=portfolio.name,
        slug=portfolio.slug,
        subdomain=subdomain.lower(),
        header=PublicResumeHeader(
            name=header.name,
            current=header.current,
            # The About is the resume's summary; hidden means not printed.
            description="" if "summary" in hidden else header.description,
            links=header_links,
            # The photo is the owner's choice; without it the file stays private.
            portrait=header.portrait if resume.style.photo else None,
        ),
        sections=sections,
        resume=resume,
    )


@router.get(
    "/p/{subdomain}/{slug}/resume",
    response_model=PublicResumeOut,
    summary="Read a published resume",
)
async def read_published_resume(
    subdomain: str, slug: str, session: SessionDep, response: Response
) -> PublicResumeOut:
    portfolio, _ = await _load_published(session, subdomain, slug, resume=True)
    # A resume is for whoever was sent the link, never for a search engine.
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return _public_resume_out(portfolio, subdomain)


@router.post(
    "/p/{subdomain}/{slug}/views",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Record a page view",
)
async def record_view(
    subdomain: str, slug: str, payload: RecordViewRequest, session: SessionDep, request: Request
) -> dict[str, bool]:
    if not allowed(PAGE_VIEW, request):
        # Over the limit is "not counted", not an error a visitor would see.
        return {"counted": False}
    portfolio, _ = await _load_published(session, subdomain, slug)
    counted = await AnalyticsService(session).record_view(
        portfolio, payload.referrer, payload.dedupe_key
    )
    # 202 either way: a visitor must never see an analytics failure, and
    # "not counted" is a legitimate outcome when the owner turned it off.
    return {"counted": counted}


@router.post(
    "/p/{subdomain}/{slug}/clicks",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Record a click on a section link",
)
async def record_click(
    subdomain: str, slug: str, payload: RecordClickRequest, session: SessionDep, request: Request
) -> dict[str, bool]:
    if not allowed(LINK_CLICK, request):
        return {"counted": False}
    portfolio, _ = await _load_published(session, subdomain, slug)
    counted = await AnalyticsService(session).record_click(
        portfolio, payload.section_id, payload.url
    )
    return {"counted": counted}


@router.get("/assets/{asset_id}", summary="An image on a published page")
async def read_public_asset(asset_id: uuid.UUID, session: SessionDep) -> Response:
    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise NotFound("That upload does not exist.", code="asset_not_found")

    if not await _is_on_a_published_page(session, asset_id):
        # An asset that is merely uploaded, or attached only to a draft,
        # stays private. Same answer as a missing one.
        raise NotFound("That upload does not exist.", code="asset_not_found")

    return await serve(asset, public=True)


async def _is_on_a_published_page(session: SessionDep, asset_id: uuid.UUID) -> bool:
    in_a_picture = await session.scalar(
        select(SectionImage.id)
        .join(Section, Section.id == SectionImage.section_id)
        .join(Portfolio, Portfolio.id == Section.portfolio_id)
        .where(
            Portfolio.status == "live",
            Section.hidden.is_(False),
            SectionImage.asset_id == asset_id,
        )
        .limit(1)
    )
    if in_a_picture is not None:
        return True

    in_a_header = await session.scalar(
        select(PortfolioHeader.id)
        .join(Portfolio, Portfolio.id == PortfolioHeader.portfolio_id)
        .where(Portfolio.status == "live", PortfolioHeader.portrait_asset_id == asset_id)
        .limit(1)
    )
    if in_a_header is not None:
        return True

    # The resume's photo, while the resume is live and the owner chose to show it.
    on_a_resume = await session.scalar(
        select(PortfolioHeader.id)
        .join(Portfolio, Portfolio.id == PortfolioHeader.portfolio_id)
        .where(
            Portfolio.resume_status == "live",
            PortfolioHeader.portrait_asset_id == asset_id,
            Portfolio.resume["style"]["photo"].as_boolean().is_(True),
        )
        .limit(1)
    )
    return on_a_resume is not None
