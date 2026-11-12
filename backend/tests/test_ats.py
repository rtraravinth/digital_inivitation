"""The ATS check: a rule-based, explainable score against one job description."""

from __future__ import annotations

from app.services.ats import ResumeText, check, extract_terms, job_title, required_years

JD = """Senior Product Designer
We are looking for a Senior Product Designer to join our payments team.
Requirements:
- 5+ years of experience in product design and UX design
- Strong skills in Figma, prototyping and design systems
- Experience with user research and usability testing
- Bachelor's degree in design or related field
- Excellent communication and collaboration skills
Nice to have: SQL, A/B testing, data analysis."""


def designer(**overrides) -> ResumeText:
    base = {
        "headline": "Product designer",
        "email": "a@example.com",
        "phone": "+91 98000 00000",
        "titles": ["Product Designer"],
        "experience": [{"start": "2016", "end": "", "current": True}],
        "bullets": ["Led design systems across 4 products", "Ran user research with 40 customers"],
        "skills": ["Figma", "Prototyping", "UX design"],
        "education": ["B.Des, National Institute of Design"],
    }
    base.update(overrides)
    return ResumeText(**base)


# ── the description ─────────────────────────────────────────────────────


def test_the_title_years_and_skills_are_read_from_the_description():
    assert job_title(JD) == "Senior Product Designer"
    assert required_years(JD) == 5
    terms = {t.text: t.kind for t in extract_terms(JD)}
    assert terms["figma"] == "hard"
    assert terms["user experience design"] == "hard"  # "UX design", folded
    assert terms["communication"] == "soft"
    # Job-ad filler and the title's own words are not keywords.
    assert not {"experience", "requirements", "designer", "nice"} & terms.keys()


def test_a_title_joined_by_small_words_is_read_whole():
    jd = "About us\nWe are looking for a Head of Operations to scale our kitchens."
    assert job_title(jd) == "Head of Operations"
    assert job_title("Role: Director of Data and Analytics\n...") == "Director of Data and Analytics"


def test_a_skill_is_found_under_another_spelling():
    report = check(designer(skills=["JS"]), "Frontend Engineer\nRequired: JavaScript and React.")
    assert "JavaScript" in [m.get("term") for m in report.matched]


# ── the score ───────────────────────────────────────────────────────────


def test_every_point_is_in_the_breakdown():
    report = check(designer(), JD)
    assert report.score == sum(b["points"] for b in report.breakdown)
    assert sum(b["outOf"] for b in report.breakdown) == 100
    assert 0 < report.score < 100


def test_adding_a_missing_skill_raises_the_score():
    before = check(designer(), JD)
    missing = [s["value"] for s in before.suggestions if s["kind"] == "add_skill"]
    assert "SQL" in missing
    after = check(designer(skills=["Figma", "Prototyping", "UX design", *missing]), JD)
    assert after.score > before.score
    assert not [s for s in after.suggestions if s["kind"] == "add_skill"]


def test_a_title_that_does_not_match_is_suggested():
    report = check(designer(headline="Visual designer", titles=["Illustrator"]), JD)
    suggestion = next(s for s in report.suggestions if s["kind"] == "use_title")
    assert suggestion["value"] == "Senior Product Designer"


def test_missing_contact_and_dates_cost_points_and_say_why():
    report = check(designer(email="", experience=[{"start": "", "end": ""}]), JD)
    readable = next(b for b in report.breakdown if b["key"] == "format")
    assert readable["points"] < readable["outOf"]
    ids = {s["id"] for s in report.suggestions}
    assert {"format:email", "format:dates"} <= ids


def test_a_degree_asked_for_and_held_scores_full():
    report = check(designer(), JD)
    assert next(b for b in report.breakdown if b["key"] == "education")["points"] == 10
    report = check(designer(education=[]), JD)
    assert next(b for b in report.breakdown if b["key"] == "education")["points"] == 0


# ── the endpoint ────────────────────────────────────────────────────────


async def _with_resume(auth_client, portfolio, skills=("Figma",)):
    section = portfolio["sections"][0]
    await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{section['id']}",
        json={"blocks": [{"id": "sk", "type": "skills"}]},
    )
    await auth_client.put(
        f"/api/v1/portfolios/{portfolio['id']}/resume",
        json={"email": "a@example.com", "skills": [{"id": "g", "name": "", "items": list(skills)}]},
    )


async def test_the_endpoint_scores_the_printed_resume(auth_client, portfolio):
    await _with_resume(auth_client, portfolio)
    url = f"/api/v1/portfolios/{portfolio['id']}/resume/ats-check"
    response = await auth_client.post(url, json={"jobDescription": JD})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Senior Product Designer"
    assert "Figma" in [m["term"] for m in body["matched"]]
    assert any(s["kind"] == "add_skill" and s["value"] == "SQL" for s in body["suggestions"])
    assert body["breakdown"][0]["outOf"] == 40


async def test_a_list_not_placed_in_a_section_is_not_read(auth_client, portfolio):
    """The resume prints only lists a section holds; the check reads the same."""
    await auth_client.put(
        f"/api/v1/portfolios/{portfolio['id']}/resume",
        json={"skills": [{"id": "g", "name": "", "items": ["Figma"]}]},
    )
    url = f"/api/v1/portfolios/{portfolio['id']}/resume/ats-check"
    body = (await auth_client.post(url, json={"jobDescription": JD})).json()
    assert "Figma" not in [m["term"] for m in body["matched"]]


async def test_a_short_description_is_refused(auth_client, portfolio):
    url = f"/api/v1/portfolios/{portfolio['id']}/resume/ats-check"
    response = await auth_client.post(url, json={"jobDescription": "Designer"})
    assert response.status_code == 422


async def test_someone_elses_resume_cannot_be_checked(other_auth_client, portfolio):
    url = f"/api/v1/portfolios/{portfolio['id']}/resume/ats-check"
    response = await other_auth_client.post(url, json={"jobDescription": JD})
    assert response.status_code == 404


async def test_the_description_is_not_stored(auth_client, portfolio):
    url = f"/api/v1/portfolios/{portfolio['id']}/resume/ats-check"
    await auth_client.post(url, json={"jobDescription": JD + " zebracorn"})
    again = await auth_client.get(f"/api/v1/portfolios/{portfolio['id']}")
    assert "zebracorn" not in again.text
