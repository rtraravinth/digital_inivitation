"""ATS check: how well a resume answers one job description.

There is no published formula for how applicant tracking systems rank a
resume, and the vendors do not document one. What every account agrees on,
and what resume-match tools describe, is a parse-then-compare pipeline:

1. read the resume as plain text in fields — contact, titles, dates, skills,
   education;
2. pull the terms that matter out of the job description;
3. score the resume on how many of those terms it carries, weighted towards
   hard skills, then the job title, education and experience asked for, then
   soft skills — and on whether it can be parsed at all.

This module does exactly that, in plain Python with no model and no network,
so every point of the score can be traced to a rule and shown to the person.
The term weighting is the classic information-retrieval kind (term frequency
with saturation, as in BM25, boosted by where the term appears), which is a
published, unencumbered technique rather than anyone's product. The skills
and synonym lists are our own.

The score is an estimate of keyword fit against one description. It is not a
prediction of what any particular ATS will do, and the UI says so.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date


def _words(text: str) -> frozenset[str]:
    """A word list written as text, one or more words a line."""
    return frozenset(text.split())


# ── vocabulary ─────────────────────────────────────────────────────────────

#: Words that carry no meaning on their own in a job description.
STOPWORDS = _words(
    """
    a about above after again against all also am an and any are as at be because been
    before being below between both but by can could did do does doing down during each
    either etc ever every few for from further had has have having he her here hers him
    his how i if in into is it its itself just let may me might more most must my no nor
    not now of off on once only or other our ours out over own per same shall she should
    so some such than that the their them then there these they this those through to
    too under until up upon us very via was we were what when where which while who whom
    why will with within without would you your yours
    """
)

#: Words every job description uses that say nothing about this job.
JD_FILLER = _words(
    """
    ability able across apply applicant applicants based benefit benefits best bonus
    candidate candidates career company competitive culture day days demonstrated
    desired duties environment equal excellent experience experienced familiarity fast
    employer employment full good great help high highly ideal ideally including job
    join key knowledge like looking new offer opportunity opportunities part people per
    plus position preferred proven qualification qualifications related required
    requirement requirements responsibilities responsibility role salary skill skills
    strong success successful team teams time understanding using want well work working
    world year years you'll we're we'll it's etc e.g i.e nice field degree bachelor
    bachelor's master master's graduate diploma equivalent senior junior lead mid level
    """
)

#: Hard skills and tools we recognise as one term even when a description
#: lists them loosely. Lower-case. Not exhaustive: anything else the
#: description repeats still counts; this list only boosts a term and keeps a
#: phrase whole.
KNOWN_SKILLS = _words(
    """
    python java javascript typescript go rust ruby php scala kotlin swift c c++ c# .net
    sql nosql postgresql mysql mongodb redis elasticsearch graphql rest react angular
    vue next.js node.js django flask fastapi spring rails laravel html css sass tailwind
    figma sketch photoshop illustrator indesign docker kubernetes terraform ansible
    jenkins git github gitlab ci/cd linux bash pandas numpy tensorflow pytorch scikit-
    learn spark hadoop airflow kafka tableau looker excel salesforce hubspot sap jira
    confluence agile scrum kanban seo sem crm erp etl api apis microservices devops
    mlops prototyping wireframing accounting budgeting forecasting valuation compliance
    audit logistics procurement p&l copywriting sales fundraising hiring recruiting cfa
    cpa pmp sebi statistics
    """
) | frozenset(
    {
        "amazon web services",
        "google cloud",
        "microsoft azure",
        "azure",
        "power bi",
        "machine learning",
        "deep learning",
        "artificial intelligence",
        "data analysis",
        "data science",
        "data engineering",
        "data visualization",
        "a/b testing",
        "product management",
        "product design",
        "project management",
        "user research",
        "user experience",
        "user experience design",
        "user interface",
        "user interface design",
        "interaction design",
        "visual design",
        "design systems",
        "usability testing",
        "information architecture",
        "financial modeling",
        "financial analysis",
        "financial planning",
        "due diligence",
        "risk management",
        "supply chain",
        "operations management",
        "content strategy",
        "social media",
        "digital marketing",
        "email marketing",
        "market research",
        "brand strategy",
        "public relations",
        "business development",
        "account management",
        "customer success",
        "stakeholder management",
        "unit economics",
        "investor relations",
    }
)

SOFT_SKILLS = frozenset(
    {
        "communication",
        "leadership",
        "collaboration",
        "teamwork",
        "problem solving",
        "problem-solving",
        "critical thinking",
        "time management",
        "adaptability",
        "creativity",
        "attention to detail",
        "mentoring",
        "negotiation",
        "presentation",
        "ownership",
        "organisation",
        "organization",
        "empathy",
        "initiative",
        "decision making",
        "decision-making",
        "storytelling",
        "facilitation",
    }
)

#: Spellings that mean the same skill. Matching folds each to its key.
SYNONYMS: dict[str, str] = {
    "js": "javascript",
    "ts": "typescript",
    "golang": "go",
    "postgres": "postgresql",
    "k8s": "kubernetes",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "ux": "user experience",
    "ui": "user interface",
    "nodejs": "node.js",
    "node": "node.js",
    "reactjs": "react",
    "react.js": "react",
    "vuejs": "vue",
    "nextjs": "next.js",
    "gcp": "google cloud",
    "aws": "amazon web services",
    "ci cd": "ci/cd",
    "cicd": "ci/cd",
    "pnl": "p&l",
    "profit and loss": "p&l",
    "organisation": "organization",
    "problem-solving": "problem solving",
    "decision-making": "decision making",
    "a b testing": "a/b testing",
}

ACTION_VERBS = _words(
    """
    achieved built created cut delivered designed developed directed drove grew improved
    increased launched led managed negotiated owned produced raised reduced ran scaled
    shipped signed spun started streamlined trained won wrote advised analysed analyzed
    automated coached established expanded founded implemented mentored migrated
    optimised optimized organised organized planned rebuilt redesigned saved secured
    simplified spearheaded
    """
)

DEGREES: list[tuple[int, str, re.Pattern[str]]] = [
    (3, "a doctorate", re.compile(r"\b(ph\.?\s?d|doctorate|doctoral)\b", re.I)),
    (
        2,
        "a master's degree",
        re.compile(
            r"\b(master'?s?|m\.?\s?s\.?c?|m\.?\s?a\.?|mba|m\.?tech|post\s?graduate)\b", re.I
        ),
    ),
    (
        1,
        "a bachelor's degree",
        re.compile(
            r"\b(bachelor'?s?|b\.?\s?(?:sc|s|a|com|tech|e|des|arch|fa|ba|ca|eng)\b\.?|undergraduate|degree)",
            re.I,
        ),
    ),
]

# ── text ───────────────────────────────────────────────────────────────────

_TOKEN = re.compile(r"[a-z0-9][a-z0-9+#./&-]*[a-z0-9+#]|[a-z0-9]")


def tokens(text: str) -> list[str]:
    """Lower-case words, keeping `c++`, `c#`, `node.js`, `ci/cd`, `p&l` whole."""
    return _TOKEN.findall(text.lower().replace("’", "'"))


def stem(word: str) -> str:
    """A light suffix strip — enough that `designs`, `designed` and `designing`
    meet `design`, without a stemmer's surprises on skill names."""
    if word in KNOWN_SKILLS or not word.isalpha() or len(word) <= 4:
        return word
    for suffix in ("ations", "ation", "ings", "ing", "ies", "ers", "ed", "es", "er", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            base = word[: -len(suffix)]
            return base + "y" if suffix == "ies" else base
    return word


def canonical(term: str) -> str:
    """One spelling per meaning: `ux design` → `user experience design`."""
    text = " ".join(tokens(term))
    if text in SYNONYMS:
        return SYNONYMS[text]
    return " ".join(
        SYNONYMS.get(w, w) if " " not in SYNONYMS.get(w, "") or len(text.split()) > 1 else w
        for w in text.split()
    )


def stems(term: str) -> tuple[str, ...]:
    return tuple(stem(t) for t in canonical(term).split())


# ── the resume as text, in fields ─────────────────────────────────────────


@dataclass
class ResumeText:
    """What an ATS would parse out of the resume we print."""

    name: str = ""
    headline: str = ""
    summary: str = ""
    email: str = ""
    phone: str = ""
    titles: list[str] = field(default_factory=list)
    experience: list[dict] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    education: list[str] = field(default_factory=list)
    other: list[str] = field(default_factory=list)
    photo: bool = False
    #: Lists that hold entries but are kept off the resume.
    hidden_lists: list[str] = field(default_factory=list)

    def fields(self) -> dict[str, str]:
        return {
            "headline": f"{self.headline} {' '.join(self.titles)}",
            "summary": self.summary,
            "skills": " ".join(self.skills),
            "experience": " ".join(self.bullets),
            "education": " ".join(self.education),
            "other": " ".join(self.other),
        }


# ── the job description ───────────────────────────────────────────────────


@dataclass
class Term:
    text: str
    weight: float
    kind: str  # "hard" | "soft" | "keyword"


_REQ_LINE = re.compile(
    r"\b(require|must|qualification|you have|you bring|experience (with|in)|proficien|skills)\b",
    re.I,
)
_TITLE_PATTERNS = [
    re.compile(r"^\s*(?:job\s+)?(?:title|position|role)\s*[:\-–]\s*(.{3,80})$", re.I | re.M),
    # "looking for a Head of Operations", "hiring a Senior Data & AI Engineer":
    # capitalised words, with the small words a title is joined by.
    re.compile(
        r"\b(?:hiring|looking for|seeking|recruiting)\s+(?:an?\s+)?(?:experienced\s+)?"
        r"([A-Z][\w/&+.-]*(?:\s+(?:of|and|&|the)\s+[A-Z][\w/&+.-]*|\s+[A-Z(][\w/&+.()-]*){0,5})",
        re.M,
    ),
]


def job_title(jd: str) -> str:
    for pattern in _TITLE_PATTERNS:
        m = pattern.search(jd)
        if m:
            return re.split(r"\s+(?:to|who|with|at|in|for)\s+|[,.;(]", m.group(1).strip())[
                0
            ].strip()
    # Most postings open with the title on a line of its own.
    for line in jd.splitlines():
        line = line.strip(" \t-•*#:")
        if 2 <= len(line.split()) <= 7 and not line.endswith((".", ":")) and len(line) <= 70:
            return line
    return ""


def required_years(jd: str) -> int:
    found = [
        int(n) for n in re.findall(r"(\d{1,2})\s*(?:\+\s*)?(?:-\s*\d{1,2}\s*)?(?:years|yrs)", jd, re.I)
    ]
    return max((n for n in found if n <= 25), default=0)


def required_degree(jd: str) -> tuple[int, str]:
    for level, name, pattern in DEGREES:
        if pattern.search(jd):
            return level, name
    return 0, ""


def extract_terms(jd: str, limit: int = 30) -> list[Term]:
    """The terms that matter in a job description, weighted.

    Candidate terms are single words and two- and three-word phrases that do
    not start or end on a stopword. Each is weighted by how often it occurs
    (saturating, so a repeated word does not swamp the list), doubled for a
    recognised hard skill, raised when it sits on a requirements line, and
    dropped when it is generic job-ad language.
    """
    lines = [ln for ln in jd.splitlines() if ln.strip()]
    counts: dict[tuple[str, ...], float] = {}
    surface: dict[tuple[str, ...], str] = {}
    for line in lines:
        boost = 1.5 if _REQ_LINE.search(line) else 1.0
        words = tokens(line)
        for n in (3, 2, 1):
            for i in range(len(words) - n + 1):
                gram = words[i : i + n]
                if gram[0] in STOPWORDS or gram[-1] in STOPWORDS or gram[0][0].isdigit():
                    continue
                if n == 1 and (gram[0] in JD_FILLER or len(gram[0]) < 2):
                    continue
                if any(w in STOPWORDS for w in gram[1:-1]) and n == 3:
                    continue
                text = " ".join(gram)
                key = stems(text)
                is_known = canonical(text) in KNOWN_SKILLS or canonical(text) in SOFT_SKILLS
                if n > 1 and not is_known and any(w in JD_FILLER for w in gram):
                    continue
                counts[key] = counts.get(key, 0.0) + boost
                # "product designer" and "product design" share a stem; the
                # spelling a skill list knows wins whichever came first.
                if is_known:
                    surface[key] = canonical(text)
                else:
                    surface.setdefault(key, text)

    terms: list[Term] = []
    for key, tf in counts.items():
        text = surface[key]
        canon = canonical(text)
        kind = "hard" if canon in KNOWN_SKILLS else "soft" if canon in SOFT_SKILLS else "keyword"
        n = len(key)
        # A phrase nobody repeats and nobody lists as a skill is usually just
        # two words that happened to sit together.
        if kind == "keyword" and n > 1 and tf < 2:
            continue
        saturated = tf * 2.2 / (tf + 1.2)  # BM25's tf saturation, k1 = 1.2
        weight = saturated * (2.0 if kind == "hard" else 1.0) * (1.0 + 0.15 * (n - 1))
        terms.append(Term(text, weight, kind))

    # The title is scored on its own; its words are not keywords too.
    title = set(stems(job_title(jd)))
    terms = [t for t in terms if t.kind != "keyword" or not set(stems(t.text)) <= title]

    terms.sort(key=lambda t: -t.weight)
    kept: list[Term] = []
    for t in terms:
        # A word already inside a longer kept phrase adds nothing.
        if any(f" {t.text} " in f" {k.text} " for k in kept):
            continue
        kept.append(t)
        if len(kept) >= limit:
            break
    return kept


# ── matching ──────────────────────────────────────────────────────────────


def where_found(term: str, fields: dict[str, str]) -> list[str]:
    target = stems(term)
    found = []
    for name, text in fields.items():
        words = tuple(stems(text)) if text else ()
        n = len(target)
        if any(words[i : i + n] == target for i in range(len(words) - n + 1)):
            found.append(name)
    return found


_YEAR = re.compile(r"(19|20)\d{2}")


def years_of_experience(experience: list[dict]) -> float:
    """Years covered by dated roles, overlaps counted once."""
    spans: list[tuple[int, int]] = []
    this_year = date.today().year
    for role in experience:
        start = _YEAR.search(role.get("start") or "")
        end = _YEAR.search(role.get("end") or "")
        if not start:
            continue
        a = int(start.group())
        b = this_year if role.get("current") or not end else int(end.group())
        if b >= a:
            spans.append((a, b))
    spans.sort()
    total, cur = 0, None
    for a, b in spans:
        if cur and a <= cur[1]:
            cur = (cur[0], max(cur[1], b))
        else:
            if cur:
                total += cur[1] - cur[0]
            cur = (a, b)
    if cur:
        total += cur[1] - cur[0]
    return float(total)


_NUMBER = re.compile(r"\d|%|₹|\$|€|£")


# ── the report ────────────────────────────────────────────────────────────


@dataclass
class Report:
    score: int
    breakdown: list[dict]
    title: str
    matched: list[dict]
    missing: list[dict]
    suggestions: list[dict]


def as_written(term: str, jd: str) -> str:
    """The term as the description spells it — "SQL", not "sql" — when it
    appears there in that form; otherwise our own spelling."""
    m = re.search(r"(?<![\w])" + re.escape(term) + r"(?![\w])", jd, re.I)
    return m.group(0) if m else term


def check(resume: ResumeText, jd: str) -> Report:
    fields = resume.fields()
    terms = extract_terms(jd)
    hard = [t for t in terms if t.kind == "hard"]
    soft = [t for t in terms if t.kind == "soft"]
    other = [t for t in terms if t.kind == "keyword"][:12]

    def coverage(group: list[Term]) -> tuple[float, list[dict], list[dict]]:
        matched, missing = [], []
        for t in group:
            where = where_found(t.text, fields)
            (matched if where else missing).append(
                {"term": t.text, "kind": t.kind, "where": where, "weight": round(t.weight, 2)}
            )
        total = sum(t.weight for t in group)
        got = sum(m["weight"] for m in matched)
        return (got / total if total else 1.0), matched, missing

    hard_ratio, hard_hit, hard_miss = coverage(hard)
    soft_ratio, soft_hit, soft_miss = coverage(soft)
    kw_ratio, kw_hit, kw_miss = coverage(other)

    # Job title: the posting's title against the headline and role titles.
    for m in [*hard_hit, *hard_miss, *soft_hit, *soft_miss, *kw_hit, *kw_miss]:
        m["term"] = as_written(m["term"], jd)

    title = job_title(jd)
    title_words = [w for w in stems(title) if w not in STOPWORDS] if title else []
    best = 0.0
    for candidate in [resume.headline, *resume.titles]:
        have = set(stems(candidate))
        if title_words:
            best = max(best, sum(w in have for w in title_words) / len(title_words))
    title_ratio = best if title_words else 1.0

    level, degree_name = required_degree(jd)
    have_level = max(
        (lvl for lvl, _, p in DEGREES for e in resume.education if p.search(e)), default=0
    )
    edu_ratio = 1.0 if level == 0 or have_level >= level else 0.0

    years_needed = required_years(jd)
    years_have = years_of_experience(resume.experience)
    years_ratio = 1.0 if years_needed == 0 else min(1.0, years_have / years_needed)

    # Can it be read: contact, dated roles, results.
    dated = [r for r in resume.experience if _YEAR.search(r.get("start") or "")]
    quantified = [b for b in resume.bullets if _NUMBER.search(b)]
    format_checks = [
        ("email", bool(resume.email)),
        ("phone", bool(resume.phone)),
        ("dates", not resume.experience or len(dated) == len(resume.experience)),
        ("skills", bool(resume.skills)),
        ("results", not resume.bullets or len(quantified) / len(resume.bullets) >= 0.3),
    ]
    format_ratio = sum(ok for _, ok in format_checks) / len(format_checks)

    parts = [
        (
            "hard",
            "Hard skills",
            40,
            hard_ratio,
            f"{len(hard_hit)} of {len(hard)} found" if hard else "None named in the description",
        ),
        (
            "title",
            "Job title",
            15,
            title_ratio,
            f"“{title}”" if title else "No title found in the description",
        ),
        (
            "keywords",
            "Other keywords",
            10,
            kw_ratio,
            f"{len(kw_hit)} of {len(other)} found" if other else "None stood out",
        ),
        (
            "education",
            "Education",
            10,
            edu_ratio,
            f"Asks for {degree_name}" if level else "No degree asked for",
        ),
        (
            "experience",
            "Experience",
            10,
            years_ratio,
            f"Asks for {years_needed}+ years · you show {years_have:g}"
            if years_needed
            else "No length asked for",
        ),
        (
            "soft",
            "Soft skills",
            5,
            soft_ratio,
            f"{len(soft_hit)} of {len(soft)} found" if soft else "None named",
        ),
        (
            "format",
            "Readable by an ATS",
            10,
            format_ratio,
            f"{sum(ok for _, ok in format_checks)} of {len(format_checks)} checks pass",
        ),
    ]
    breakdown = [
        {"key": k, "label": label, "points": round(w * r), "outOf": w, "detail": detail}
        for k, label, w, r, detail in parts
    ]
    score = sum(b["points"] for b in breakdown)

    suggestions: list[dict] = []
    for m in sorted(hard_miss, key=lambda m: -m["weight"])[:15]:
        suggestions.append(
            {
                "id": f"skill:{m['term']}",
                "kind": "add_skill",
                "title": f"Add “{m['term']}” to your skills",
                "detail": "The description asks for it and your resume never says it. Add it only if it is true of you.",
                "value": m["term"],
            }
        )
    if title and title_ratio < 1.0:
        suggestions.append(
            {
                "id": "title",
                "kind": "use_title",
                "title": f"Lead your headline with “{title}”",
                "detail": "An ATS compares the job title with your headline and role titles first.",
                "value": title,
            }
        )
    for block in resume.hidden_lists:
        suggestions.append(
            {
                "id": f"show:{block}",
                "kind": "show_block",
                "title": f"Print {block.capitalize()} on your resume",
                "detail": "It has entries but is switched off for the resume, so an ATS never reads them.",
                "value": block,
            }
        )
    for m in sorted(soft_miss, key=lambda m: -m["weight"])[:3]:
        suggestions.append(
            {
                "id": f"soft:{m['term']}",
                "kind": "tip",
                "title": f"Show “{m['term']}” in a role",
                "detail": "Soft skills read best as something you did — a bullet that shows it — not as a word in a list.",
            }
        )
    for m in kw_miss[:4]:
        suggestions.append(
            {
                "id": f"kw:{m['term']}",
                "kind": "tip",
                "title": f"Mention “{m['term']}” where it is true",
                "detail": "The description repeats it. Work it into your summary or a role if it describes your work.",
            }
        )
    tips = {
        "email": (
            "Add an email address",
            "Contact details are the first thing an ATS parses. Add them under Resume contact details in your header.",
        ),
        "phone": (
            "Add a phone number",
            "Recruiters filter on it, and the ATS expects it with your email.",
        ),
        "dates": (
            "Give every role its dates",
            "An ATS works out your years of experience from them; a role without dates counts for nothing.",
        ),
        "skills": (
            "Add a Skills list",
            "A plain list of skills is the most reliable place for an ATS to find them.",
        ),
        "results": (
            "Put numbers in your bullets",
            "Fewer than a third of your points carry a figure. Results with numbers rank and read better.",
        ),
    }
    for key, ok in format_checks:
        if not ok:
            title_, detail = tips[key]
            suggestions.append(
                {"id": f"format:{key}", "kind": "tip", "title": title_, "detail": detail}
            )
    if level and edu_ratio < 1.0:
        suggestions.append(
            {
                "id": "education",
                "kind": "tip",
                "title": f"The role asks for {degree_name}",
                "detail": "If you have one, list it under Education with the degree's full name.",
            }
        )
    if years_needed and years_ratio < 1.0:
        suggestions.append(
            {
                "id": "years",
                "kind": "tip",
                "title": f"The role asks for {years_needed}+ years",
                "detail": f"Your dated roles add up to {years_have:g}. Check that every relevant role has its start and end.",
            }
        )
    if resume.photo:
        suggestions.append(
            {
                "id": "photo",
                "kind": "tip",
                "title": "Consider leaving the photo off",
                "detail": "Many ATS and employers prefer resumes without one.",
            }
        )

    return Report(
        score=score,
        breakdown=breakdown,
        title=title,
        matched=hard_hit + kw_hit + soft_hit,
        missing=hard_miss + kw_miss + soft_miss,
        suggestions=suggestions,
    )


# ── from a stored portfolio ───────────────────────────────────────────────

#: The resume lists, in the order a resume prints them by default.
LISTS = ("experience", "education", "skills", "certifications", "languages", "awards")


def resume_text(header: dict, resume: dict, sections: list[dict]) -> ResumeText:
    """The resume a portfolio prints, as an ATS would read it.

    Mirrors what the resume sheet draws (`visibleBlocks()` in
    src/lib/resume.ts): a list prints when a section places its component and
    the list is not switched off for the resume; sections switched on for the
    resume print as entries. Hand it plain dicts — the stored JSON, camelCase.
    """
    placed = {
        b.get("type") for s in sections for b in (s.get("blocks") or []) if isinstance(b, dict)
    }
    hidden = set(resume.get("hidden") or [])
    prints = {name for name in LISTS if name in placed and name not in hidden}

    out = ResumeText(
        name=header.get("name") or "",
        headline=header.get("current") or "",
        summary=header.get("description") or "" if "summary" not in hidden else "",
        email=resume.get("email") or "",
        phone=resume.get("phone") or "",
        photo=bool((resume.get("style") or {}).get("photo")) and bool(header.get("portrait")),
    )
    if "experience" in prints:
        for role in resume.get("experience") or []:
            out.experience.append(role)
            out.titles.append(role.get("role") or "")
            out.bullets.extend(b for b in role.get("bullets") or [] if b.strip())
            out.other.append(f"{role.get('company') or ''} {role.get('location') or ''}")
    if "education" in prints:
        out.education = [
            f"{e.get('degree') or ''} {e.get('school') or ''} {e.get('detail') or ''}"
            for e in resume.get("education") or []
        ]
    if "skills" in prints:
        out.skills = [
            i
            for g in resume.get("skills") or []
            for i in [g.get("name") or "", *(g.get("items") or [])]
            if i
        ]
    if "certifications" in prints:
        out.other += [
            f"{c.get('name') or ''} {c.get('issuer') or ''}"
            for c in resume.get("certifications") or []
        ]
    if "awards" in prints:
        out.other += [
            f"{a.get('title') or ''} {a.get('detail') or ''}" for a in resume.get("awards") or []
        ]
    if "languages" in prints:
        out.other += [lang.get("name") or "" for lang in resume.get("languages") or []]
    if "projects" not in hidden:
        for s in sections:
            if s.get("onResume") and (s.get("title") or s.get("description")):
                out.other.append(f"{s.get('title') or ''} {s.get('description') or ''}")

    # A list with entries that the author has switched off for the resume.
    for name in LISTS:
        if name in placed and name in hidden and resume.get(name):
            out.hidden_lists.append(name)
    return out
