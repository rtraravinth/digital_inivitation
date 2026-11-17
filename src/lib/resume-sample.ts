import type { Block, Portfolio, Section } from "./types";

/* ── the sample resume the template thumbnails are drawn with ────────────
   A thumbnail drawn from the author's own resume shows nothing while the
   resume is still empty — a name over a blank page in all thirty-two, with
   nothing to tell them apart. So each thumbnail sets this filled-in resume
   instead: a few roles with dates and results, a degree, skills,
   certifications, languages and an award, which is every kind of entry a
   template styles. The author's name, headline, portrait and style are
   kept, so the thumbnail is still theirs at a glance. The sheet beside the
   picker always shows the real content.
   ──────────────────────────────────────────────────────────────────────── */

const section = (id: string, title: string, blocks: Block[], description = ""): Section => ({
  id: `sample-${id}`,
  title,
  description,
  tab: title,
  links: [],
  images: [],
  quote: null,
  blocks,
  hidden: false,
  onResume: true,
});

const SAMPLE_SECTIONS: Section[] = [
  section("experience", "Experience", [
    {
      id: "sample-experience-list",
      type: "experience",
      title: "",
      onResume: true,
      look: "theme",
      items: [
        {
          id: "sx1",
          role: "Senior Product Designer",
          company: "Northwind Labs",
          location: "London",
          start: "Mar 2021",
          end: "",
          current: true,
          heading: "",
          bullets: [
            "• Led a team of 6 to rebuild checkout, cutting drop-off by **18%**",
            "• Built the design system used across 4 products and 40 engineers",
            "• Ran research with 60 customers each quarter to shape the roadmap",
          ],
          formatted: true,
        },
        {
          id: "sx2",
          role: "Product Designer",
          company: "Brightline",
          location: "Remote",
          start: "Jun 2018",
          end: "Feb 2021",
          current: false,
          heading: "",
          bullets: [
            "• Shipped onboarding that lifted activation from 31% to 47%",
            "• Introduced usability testing to every release cycle",
          ],
          formatted: true,
        },
        {
          id: "sx3",
          role: "UX Designer",
          company: "Harbour Studio",
          location: "Bristol",
          start: "Sep 2016",
          end: "May 2018",
          current: false,
          heading: "",
          bullets: ["• Designed web and mobile apps for 12 clients in retail and travel"],
          formatted: true,
        },
      ],
    },
  ]),
  section("education", "Education", [
    {
      id: "sample-education-list",
      type: "education",
      title: "",
      onResume: true,
      look: "theme",
      items: [
        {
          id: "se1",
          degree: "BA Interaction Design",
          school: "University of the Arts",
          location: "London",
          start: "2013",
          end: "2016",
          detail: "First-class honours",
        },
      ],
    },
  ]),
  section("skills", "Skills", [
    {
      id: "sample-skills-list",
      type: "skills",
      title: "",
      onResume: true,
      look: "theme",
      items: [
        { id: "ss1", name: "Design", items: ["Product design", "Design systems", "Prototyping", "User research"] },
        { id: "ss2", name: "Tools", items: ["Figma", "Framer", "Miro", "HTML & CSS"] },
      ],
    },
  ]),
  section("certifications", "Certifications", [
    {
      id: "sample-certifications-list",
      type: "certifications",
      title: "",
      onResume: true,
      look: "theme",
      items: [{ id: "sc1", name: "Certified Usability Analyst", issuer: "Human Factors International", date: "2020", url: "" }],
    },
  ]),
  section("languages", "Languages", [
    {
      id: "sample-languages-list",
      type: "languages",
      title: "",
      onResume: true,
      look: "theme",
      items: [
        { id: "sl1", name: "English", level: "Native" },
        { id: "sl2", name: "Spanish", level: "Professional" },
      ],
    },
  ]),
  section("awards", "Awards", [
    {
      id: "sample-awards-list",
      type: "awards",
      title: "",
      onResume: true,
      look: "theme",
      items: [{ id: "sa1", title: "Design Award, Best Checkout", issuer: "UX Collective", date: "2023", detail: "" }],
    },
  ]),
];

/** The portfolio as a template thumbnail draws it: the sample resume under
 *  the author's own name, headline, portrait and style. */
export function sampleResume(p: Portfolio): Portfolio {
  return {
    ...p,
    header: {
      ...p.header,
      name: p.header.name.trim() || "Alex Morgan",
      current: p.header.current.trim() || "Senior Product Designer",
      description:
        "Product designer with eight years of turning research into shipped work. I lead small teams, build design systems and measure what changes.",
    },
    sections: SAMPLE_SECTIONS,
    resume: {
      ...p.resume,
      email: "alex@example.com",
      phone: "+44 20 7946 0000",
      location: "London, UK",
      website: "alexmorgan.design",
      // The summary prints in the sample, whatever the author switched off.
      hidden: p.resume.hidden.filter((h) => h !== "summary"),
    },
  };
}
