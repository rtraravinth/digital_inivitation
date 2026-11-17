import { PICTURES, PORTRAIT } from "./seed-images";
import {
  normalize,
  type Asset,
  type Block,
  type ListLook,
  type PageBlock,
  type Portfolio,
  type PortfolioHeader,
  type Resume,
  type Section,
} from "./types";

/** Optional fields fall back to the defaults in normalize(). */
type Opt = "images" | "quote" | "hidden" | "onResume" | "tab";
/** A list component written without `items` takes the seed's resume list of
 *  its kind — normalize() hands it over, as it does for older stored data. */
type SeedListBlock = { id: string; type: PageBlock; title: string; look: ListLook; onResume: boolean };
type SeedSection = Omit<Section, Opt | "blocks"> &
  Partial<Pick<Section, Opt>> & { blocks?: Array<Block | SeedListBlock> };

type HeaderOpt = "portrait" | "numbers" | "dates";
type SeedHeader = Omit<PortfolioHeader, HeaderOpt> &
  Partial<Pick<PortfolioHeader, HeaderOpt>>;

type SeedPortfolio = Omit<
  Portfolio,
  "theme" | "accent" | "ground" | "groundHex" | "font" | "bodyFont" | "layout" | "resume" | "resumeStatus" | "sections" | "header" | "footer"
> &
  Partial<
    Pick<Portfolio, "theme" | "accent" | "ground" | "groundHex" | "font" | "bodyFont" | "layout" | "footer" | "resumeStatus">
  > & {
    /** Only the full page carries one; normalize() gives the rest the defaults. */
    resume?: Partial<Resume>;
    sections: SeedSection[];
    header: SeedHeader;
  };

/** A sample upload. The import turns its data URL into a stored asset and
 *  points every gallery that names `id` at it. */
function pic(id: string, picture: keyof typeof PICTURES, name: string): Asset {
  return { id, name, mime: "image/jpeg", size: 0, dataUrl: PICTURES[picture] };
}

/**
 * Seed content. Every line here is lifted from, or built to match, the
 * Rohan Mehta persona the design canvas is written around.
 */
const RAW: SeedPortfolio[] = [
  {
    id: "full",
    name: "Rohan Mehta — Full portfolio",
    slug: "full",
    status: "live",
    summary:
      "Everything: both businesses, the advisory practice, the letter and the clinic.",
    meta: "6 sections · updated 2 days ago",
    // The fullest page carries Aurora, the default: its glass nav, numbers
    // and timeline all want content behind them, and the flagship theme
    // should open on the richest page the seed has.
    theme: "aurora",
    header: {
      name: "Rohan Mehta",
      current:
        "Founder, Northwell Kitchens · SEBI-registered investment adviser · Bengaluru",
      description:
        "I run two operating businesses and advise sixty households on their money. I write a fortnightly letter about household finance, and on Sundays I teach a free clinic for gig workers.",
      tags: ["Founder", "Financial adviser", "Writer", "Trustee"],
      // The page draws one "By the numbers" row and one timeline, so these
      // belong to the portfolio. Order and content are what the sections
      // used to add up to.
      numbers: [
        { id: "n1", value: "11", label: "Brands" },
        { id: "n2", value: "42", label: "People" },
        { id: "n3", value: "82", label: "Issues" },
        { id: "n4", value: "14,200", label: "Subscribers" },
        { id: "n5", value: "60", label: "Households advised" },
      ],
      dates: [
        { id: "d1", year: "2019", text: "Northwell Kitchens founded" },
        { id: "d2", year: "2020", text: "SEBI registration granted" },
        { id: "d3", year: "2021", text: "The Slow Compounding letter begins" },
        { id: "d4", year: "2022", text: "First profitable year" },
      ],
      links: [
        { id: "h1", label: "Email", url: "rohan@northwell.in" },
        { id: "h2", label: "LinkedIn", url: "/in/rohanmehta", icon: "briefcase" },
        { id: "h3", label: "Newsletter", url: "slowcompounding.in", icon: "globe" },
      ],
    },
    // The full page is also the full resume: the roles behind the page's
    // sections, with the dates and results a page has no fields for.
    resume: {
      email: "rohan@northwell.in",
      phone: "+91 98450 12345",
      location: "Bengaluru, India",
      website: "slowcompounding.in",
      experience: [
        {
          id: "x1",
          role: "Founder & CEO",
          company: "Northwell Kitchens",
          location: "Bengaluru",
          start: "Jan 2019",
          end: "",
          current: true,
          heading: "",
          formatted: false,
          bullets: [
            "Built a cloud-kitchen company to eleven brands across four facilities and 42 people",
            "Reached profitability in 2022 by cutting food cost from 38% to 29% of revenue",
            "Spun out the supply arm as Meridian Supply Co. in 2023",
          ],
        },
        {
          id: "x2",
          role: "Co-founder",
          company: "Meridian Supply Co.",
          location: "Bengaluru",
          start: "Apr 2023",
          end: "",
          current: true,
          heading: "",
          formatted: false,
          bullets: [
            "Cold-chain logistics for small food businesses that cannot run their own fleet",
            "Signed 30 restaurant clients in the first year with no sales team",
          ],
        },
        {
          id: "x3",
          role: "Investment Adviser (SEBI RIA)",
          company: "Independent practice",
          location: "Bengaluru",
          start: "2020",
          end: "",
          current: true,
          heading: "",
          formatted: false,
          bullets: [
            "Fee-only adviser to sixty households; no commissions and no product sales",
            "Write The Slow Compounding, a fortnightly letter with 14,200 subscribers",
          ],
        },
        {
          id: "x4",
          role: "Associate, Consumer",
          company: "Halcyon Capital",
          location: "Mumbai",
          start: "Jul 2015",
          end: "Dec 2018",
          current: false,
          heading: "",
          formatted: false,
          bullets: [
            "Diligence on 20+ consumer and food-service deals; led two seed investments",
          ],
        },
      ],
      education: [
        {
          id: "e1",
          degree: "MBA, Finance",
          school: "Indian School of Business",
          location: "Hyderabad",
          start: "2014",
          end: "2015",
          detail: "",
        },
        {
          id: "e2",
          degree: "B.Com (Honours)",
          school: "Shri Ram College of Commerce",
          location: "Delhi",
          start: "2009",
          end: "2012",
          detail: "",
        },
      ],
      skills: [
        { id: "k1", name: "Operations", items: ["Unit economics", "Supply chain", "Hiring", "P&L ownership"] },
        { id: "k2", name: "Finance", items: ["Financial planning", "Portfolio construction", "Tax"] },
      ],
      certifications: [
        { id: "c1", name: "SEBI Registered Investment Adviser", issuer: "SEBI", date: "2020", url: "" },
        { id: "c2", name: "Certified Financial Planner", issuer: "FPSB India", date: "2019", url: "" },
      ],
      languages: [
        { id: "l1", name: "English", level: "Fluent" },
        { id: "l2", name: "Hindi", level: "Native" },
        { id: "l3", name: "Kannada", level: "Conversational" },
      ],
      awards: [],
    },
    sections: [
      {
        id: "s1",
        title: "Northwell Kitchens",
        description:
          "A cloud-kitchen company running eleven brands out of four Bengaluru facilities. Founded 2019, profitable since 2022, forty-two people on payroll.",
        links: [
          { id: "s1l1", label: "Company", url: "northwell.in", icon: "globe" },
          { id: "s1l2", label: "Press", url: "northwell.in/press", icon: "document" },
        ],
        blocks: [
          {
            id: "s1b1",
            type: "timeline",
            onResume: false,
            title: "How it grew",
            items: [
              { id: "s1t1", date: "2019", title: "One kitchen, two brands", text: "A rented facility in HSR Layout and a biryani menu we still run." },
              { id: "s1t2", date: "2021", title: "Four facilities", text: "Expanded across the city during the delivery boom, without outside money." },
              { id: "s1t3", date: "2022", title: "Profitable", text: "Every brand pays for itself; the weakest two were closed rather than subsidised." },
              { id: "s1t4", date: "2024", title: "Eleven brands", text: "Forty-two people on payroll and a training kitchen of our own." },
            ],
          },
        ],
      },
      {
        id: "s2",
        title: "Meridian Supply Co.",
        description:
          "Cold-chain logistics for small food businesses that cannot afford their own fleet. Started as Northwell's own supply arm and spun out in 2023.",
        links: [
          { id: "s2l1", label: "Company", url: "meridiansupply.in", icon: "globe" },
        ],
      },
      {
        id: "s3",
        title: "The Slow Compounding letter",
        description:
          "A fortnightly letter on household finance for people who don't work in finance. Eighty-two issues, 14,200 subscribers, no advertising.",
        links: [
          { id: "s3l1", label: "Read the letter", url: "slowcompounding.in", icon: "globe" },
          { id: "s3l2", label: "Subscribe", url: "slowcompounding.in/join", icon: "globe" },
        ],
        quote: {
          text: "The only letter about money my parents actually finish.",
          attribution: "A subscriber, unprompted",
        },
        blocks: [
          {
            id: "s3b2",
            type: "stats",
            onResume: false,
            title: "",
            items: [
              { id: "s3n1", value: "82", label: "Issues" },
              { id: "s3n2", value: "14,200", label: "Subscribers" },
              { id: "s3n3", value: "61%", label: "Open rate" },
            ],
          },
        ],
      },
      {
        id: "s4",
        title: "Advisory practice",
        description:
          "SEBI-registered investment adviser to sixty households, fee-only, no commissions and no product sales. Taking four new families a year.",
        links: [
          {
            id: "s4l1",
            label: "How it works",
            url: "slowcompounding.in/advisory",
            icon: "document",
          },
          { id: "s4l2", label: "Book an intro call", url: "cal.com/rohanmehta" },
        ],
        blocks: [
          {
            id: "s4b1",
            type: "services",
            onResume: false,
            title: "What I offer",
            items: [
              { id: "s4v1", title: "Financial plan", text: "A written plan for your household: goals, insurance, investments and tax, reviewed with you in two sessions.", price: "₹45,000 one-time" },
              { id: "s4v2", title: "Ongoing advice", text: "Quarterly reviews, rebalancing calls and a WhatsApp line for the questions in between.", price: "₹90,000 a year" },
              { id: "s4v3", title: "Second opinion", text: "One session on a portfolio or a policy you already hold, with a written note after.", price: "₹8,000" },
            ],
          },
          {
            id: "s4b2",
            type: "tabs",
            onResume: false,
            title: "How it works",
            items: [
              { id: "s4a1", label: "First call", text: "Thirty minutes, free. We talk about where you are and whether I am the right adviser. Often I am not, and I will say so." },
              { id: "s4a2", label: "The plan", text: "Two working sessions and a written plan within three weeks. Every recommendation says what it costs you and why." },
              { id: "s4a3", label: "After", text: "You implement on your own platforms; I never hold your money. Reviews every quarter, more often in a bad year." },
            ],
          },
          {
            id: "s4b3",
            type: "faq",
            onResume: false,
            title: "Questions families ask",
            items: [
              { id: "s4f1", question: "Do you earn commissions?", answer: "No. I am fee-only: the fee is the whole of what I earn, so no product I suggest pays me anything." },
              { id: "s4f2", question: "Do you work outside Bengaluru?", answer: "Yes. Most sessions are on video; about a third of the families I advise live in other cities." },
              { id: "s4f3", question: "Is there a minimum portfolio size?", answer: "No minimum. The plan is about the household, not the size of the portfolio." },
            ],
          },
        ],
      },
      {
        id: "s5",
        title: "The Sunday clinic",
        description:
          "A free money clinic for gig workers, every Sunday morning in Indiranagar. Two hours, no appointment, whatever you want to ask. Running since 2022.",
        links: [
          {
            id: "s5l1",
            label: "Where and when",
            url: "slowcompounding.in/clinic",
            icon: "calendar",
          },
        ],
      },
      {
        id: "s6",
        title: "Trustee, Sanjeevani Schools Trust",
        description:
          "On the board of a trust running three low-fee schools in north Karnataka. I chair the finance committee.",
        links: [
          { id: "s6l1", label: "Trust", url: "sanjeevanitrust.org", icon: "globe" },
        ],
      },
      // The page already tells the businesses as sections, so the roles stay
      // on the resume. The facts a page has no other home for go on both: one
      // section holding four of the resume's lists as components.
      {
        id: "s8",
        title: "Background",
        description: "",
        links: [],
        onResume: true,
        blocks: [
          { id: "s8b1", type: "education", onResume: true, title: "Education", look: "list" },
          { id: "s8b2", type: "skills", onResume: true, title: "Skills", look: "chips" },
          { id: "s8b3", type: "certifications", onResume: true, title: "Certifications", look: "list" },
          { id: "s8b4", type: "languages", onResume: true, title: "Languages", look: "chips" },
        ],
      },
      // The roles are on the resume only: the page tells the businesses as
      // sections already. A section off the page is how a list is kept to
      // the resume — the resume prints what a section places.
      {
        id: "s9",
        title: "Experience",
        description: "",
        links: [],
        hidden: true,
        onResume: true,
        blocks: [{ id: "s9b1", type: "experience", onResume: true, title: "", look: "theme" }],
      },
      {
        id: "s7",
        title: "Work with me",
        description:
          "Advisory enquiries, speaking at your company or a conversation about the businesses. I read everything and answer within two working days.",
        links: [],
        onResume: false,
        blocks: [
          {
            id: "s7b1",
            type: "contact",
            onResume: false,
            title: "Get in touch",
            text: "Write a line about what you need and I will come back with a time.",
            email: "rohan@slowcompounding.in",
            phone: "+91 98450 12345",
            location: "Indiranagar, Bengaluru",
            ctaLabel: "Book an intro call",
            ctaUrl: "cal.com/rohanmehta",
            form: true,
          },
        ],
      },
    ],
    footer: {
      headline: "Let’s talk about your money, or your kitchen.",
      text: "Four new advisory families a year, and a standing coffee for anyone building a food business in Bengaluru.",
      ctaLabel: "Email Rohan",
      ctaUrl: "mailto:rohan@slowcompounding.in",
      links: [{ id: "f1", label: "The letter", url: "slowcompounding.in", icon: "globe" }],
      note: "© 2026 Rohan Mehta · Bengaluru",
      showHeaderLinks: true,
    },
  },
  {
    id: "investors",
    name: "Investor one-pager",
    slug: "investors",
    status: "draft",
    summary: "Just the two businesses, the numbers, and how to reach me.",
    meta: "3 sections · updated 6 days ago",
    header: {
      name: "Rohan Mehta",
      current: "Founder, Northwell Kitchens · Co-founder, Meridian Supply Co.",
      description:
        "Two operating businesses in food and cold-chain logistics, both in Bengaluru.",
      tags: ["Founder", "Food", "Logistics"],
      links: [{ id: "ih1", label: "Email", url: "rohan@northwell.in" }],
    },
    sections: [
      {
        id: "i1",
        title: "Northwell Kitchens",
        description:
          "Eleven brands, four facilities, profitable since 2022. ₹18 Cr revenue run rate.",
        links: [
          { id: "i1l1", label: "Deck", url: "northwell.in/deck", icon: "document" },
        ],
      },
      {
        id: "i2",
        title: "Meridian Supply Co.",
        description:
          "Cold-chain logistics, spun out of Northwell in 2023. Two hundred and forty customers.",
        links: [
          { id: "i2l1", label: "Deck", url: "meridiansupply.in/deck", icon: "document" },
        ],
      },
      {
        id: "i3",
        title: "How I work",
        description:
          "Operator first. I stay close to the kitchens and the trucks, and I do not raise for the sake of raising.",
        links: [{ id: "i3l1", label: "Book a call", url: "cal.com/rohanmehta" }],
      },
    ],
  },
  {
    id: "advisory",
    name: "Advisory clients",
    slug: "advisory",
    status: "live",
    summary: "The practice, the fee, the clinic. Nothing about the businesses.",
    // Journey: the free clinic and the households advised are the story this
    // page tells, which is what the stacking chapters are for.
    theme: "journey",
    meta: "3 sections · updated 12 days ago",
    header: {
      name: "Rohan Mehta",
      current: "SEBI-registered investment adviser · Bengaluru",
      description:
        "Fee-only advice to sixty households. No commissions, no product sales, no minimum portfolio.",
      tags: ["SEBI RIA", "Fee-only", "Writer"],
      links: [
        { id: "ah1", label: "Email", url: "rohan@slowcompounding.in" },
        { id: "ah2", label: "Newsletter", url: "slowcompounding.in", icon: "globe" },
      ],
    },
    sections: [
      {
        id: "a1",
        title: "Advisory practice",
        description:
          "Fee-only, SEBI-registered, sixty households. Taking four new families a year.",
        links: [
          {
            id: "a1l1",
            label: "How it works",
            url: "slowcompounding.in/advisory",
            icon: "document",
          },
        ],
      },
      {
        id: "a2",
        title: "The Slow Compounding letter",
        description: "A fortnightly letter on household finance. Eighty-two issues.",
        links: [
          { id: "a2l1", label: "Read", url: "slowcompounding.in", icon: "globe" },
        ],
      },
      {
        id: "a3",
        title: "The Sunday clinic",
        description: "Free, every Sunday morning in Indiranagar. No appointment.",
        links: [
          {
            id: "a3l1",
            label: "Where and when",
            url: "slowcompounding.in/clinic",
            icon: "calendar",
          },
        ],
      },
    ],
  },
  {
    id: "writing",
    name: "Writing only",
    slug: "writing",
    status: "live",
    summary: "For editors and podcast bookers. The letter and nothing else.",
    meta: "2 sections · updated 1 month ago",
    theme: "stage",
    header: {
      name: "Rohan Mehta",
      current: "Writer of The Slow Compounding letter",
      description:
        "I write a fortnightly letter about household finance for people who don't work in finance.",
      tags: ["Writer", "Newsletter"],
      links: [
        { id: "wh1", label: "Newsletter", url: "slowcompounding.in", icon: "globe" },
      ],
    },
    sections: [
      {
        id: "w1",
        title: "The Slow Compounding letter",
        description: "Eighty-two issues, 14,200 subscribers, no advertising.",
        links: [
          {
            id: "w1l1",
            label: "Archive",
            url: "slowcompounding.in/archive",
            icon: "document",
          },
        ],
      },
      {
        id: "w2",
        title: "Elsewhere",
        description:
          "Occasional columns on household finance, and a standing offer to come on your podcast and argue about index funds.",
        links: [{ id: "w2l1", label: "Email", url: "rohan@slowcompounding.in" }],
      },
    ],
  },
  {
    id: "board",
    name: "Board & trustee",
    slug: "board",
    status: "draft",
    summary: "Governance work only — for trusts and boards doing diligence.",
    meta: "2 sections · updated 1 month ago",
    theme: "meridian",
    header: {
      name: "Rohan Mehta",
      current: "Trustee, Sanjeevani Schools Trust · Chair, finance committee",
      description:
        "I sit on one board and chair its finance committee. I take governance work seriously and I take very little of it.",
      tags: ["Trustee", "Governance"],
      // Meridian draws a numbers row and a timeline. Without these the
      // credentials page would have the least to show of any seed.
      numbers: [
        { id: "bn1", value: "3", label: "Schools" },
        { id: "bn2", value: "1,400", label: "Pupils" },
        { id: "bn3", value: "6", label: "Board meetings a year" },
        { id: "bn4", value: "5", label: "Years a trustee" },
      ],
      dates: [
        { id: "bd1", year: "2020", text: "Joined the Sanjeevani Schools Trust board" },
        { id: "bd2", year: "2022", text: "Elected chair of the finance committee" },
        { id: "bd3", year: "2023", text: "Audit and reserves policy rewritten" },
        { id: "bd4", year: "2024", text: "Third school opens, in Ballari" },
      ],
      links: [{ id: "bh1", label: "Email", url: "rohan@northwell.in" }],
    },
    sections: [
      {
        id: "b1",
        title: "Sanjeevani Schools Trust",
        description:
          "Three low-fee schools in north Karnataka. Trustee since 2020, chair of the finance committee since 2022.",
        links: [
          { id: "b1l1", label: "Trust", url: "sanjeevanitrust.org", icon: "globe" },
        ],
      },
      {
        id: "b2",
        title: "What I bring",
        description:
          "Operating experience in a low-margin business, and a reasonable tolerance for reading an audit file end to end.",
        links: [],
      },
    ],
  },
  // Every field the editor has, filled in, so the builder and the preview
  // show what each one draws: header extras and portrait, cover pictures,
  // all three gallery layouts, a quote, every component (each resume
  // list in a different look), a hidden section and a full footer.
  {
    id: "showcase",
    name: "Showcase — every component",
    slug: "showcase",
    status: "draft",
    summary: "Sample data: every field and component the editor offers, with pictures.",
    meta: "11 sections · sample",
    theme: "aurora",
    accent: "#c2410c",
    font: "playfair-display",
    bodyFont: "inter",
    header: {
      name: "Rohan Mehta",
      current: "Founder, Northwell Kitchens · Adviser · Writer · Bengaluru",
      description:
        "I run two food businesses, advise sixty households on their money and write a fortnightly letter about it. This page is the sample: every part of the editor, filled in.",
      tags: ["Founder", "Adviser", "Writer", "Trustee", "Cook"],
      portrait: { id: "img-portrait", name: "rohan.jpg", mime: "image/jpeg", size: 0, dataUrl: PORTRAIT },
      numbers: [
        { id: "sn1", value: "11", label: "Brands" },
        { id: "sn2", value: "42", label: "People" },
        { id: "sn3", value: "14,200", label: "Subscribers" },
        { id: "sn4", value: "60", label: "Households" },
      ],
      dates: [
        { id: "sd1", year: "2015", text: "Joined Halcyon Capital" },
        { id: "sd2", year: "2019", text: "Northwell Kitchens founded" },
        { id: "sd3", year: "2021", text: "First issue of the letter" },
        { id: "sd4", year: "2023", text: "Meridian Supply Co. spun out" },
        { id: "sd5", year: "2026", text: "Eleventh brand launched" },
      ],
      links: [
        { id: "sh1", label: "Email", url: "mailto:rohan@example.com" },
        { id: "sh2", label: "Phone", url: "tel:+919845012345" },
        { id: "sh3", label: "Website", url: "https://example.com" },
        { id: "sh4", label: "GitHub", url: "https://github.com/example" },
        { id: "sh5", label: "Instagram", url: "https://instagram.com/example" },
        { id: "sh6", label: "YouTube", url: "https://youtube.com/@example" },
        { id: "sh7", label: "Substack", url: "https://example.substack.com" },
      ],
    },
    resume: {
      email: "rohan@example.com",
      phone: "+91 98450 12345",
      location: "Bengaluru, India",
      website: "example.com",
      experience: [
        {
          id: "sx1",
          role: "Founder & CEO",
          company: "Northwell Kitchens",
          location: "Bengaluru",
          start: "Jan 2019",
          end: "",
          current: true,
          heading: "",
          formatted: false,
          bullets: [
            "Grew a cloud kitchen to eleven brands, four facilities and 42 people",
            "Cut food cost from 38% to 29% of revenue and reached profit in 2022",
          ],
        },
        {
          id: "sx2",
          role: "Co-founder",
          company: "Meridian Supply Co.",
          location: "Bengaluru",
          start: "Apr 2023",
          end: "",
          current: true,
          heading: "",
          formatted: false,
          bullets: ["Cold-chain logistics for thirty restaurants in its first year"],
        },
        {
          id: "sx3",
          role: "Associate, Consumer",
          company: "Halcyon Capital",
          location: "Mumbai",
          start: "Jul 2015",
          end: "Dec 2018",
          current: false,
          heading: "",
          formatted: false,
          bullets: ["Diligence on 20+ consumer deals; led two seed investments"],
        },
      ],
      education: [
        { id: "se1", degree: "MBA, Finance", school: "Indian School of Business", location: "Hyderabad", start: "2014", end: "2015", detail: "Dean's list" },
        { id: "se2", degree: "B.Com (Honours)", school: "Shri Ram College of Commerce", location: "Delhi", start: "2009", end: "2012", detail: "" },
      ],
      skills: [
        { id: "sk1", name: "Operations", items: ["Unit economics", "Supply chain", "Hiring", "P&L"] },
        { id: "sk2", name: "Finance", items: ["Financial planning", "Portfolio construction", "Tax"] },
        { id: "sk3", name: "Kitchen", items: ["Menu costing", "Food safety", "Biryani"] },
      ],
      certifications: [
        { id: "sc1", name: "SEBI Registered Investment Adviser", issuer: "SEBI", date: "2020", url: "https://example.com/ria" },
        { id: "sc2", name: "Certified Financial Planner", issuer: "FPSB India", date: "2019", url: "" },
        { id: "sc3", name: "Food Safety Supervisor", issuer: "FSSAI", date: "2019", url: "" },
      ],
      languages: [
        { id: "sl1", name: "English", level: "Fluent" },
        { id: "sl2", name: "Hindi", level: "Native" },
        { id: "sl3", name: "Kannada", level: "Conversational" },
      ],
      awards: [
        { id: "sa1", title: "Food Entrepreneur of the Year", issuer: "Bengaluru Restaurant Forum", date: "2024", detail: "For the training kitchen." },
        { id: "sa2", title: "Best Personal Finance Newsletter", issuer: "Indian Newsletter Awards", date: "2023", detail: "" },
      ],
      style: {
        template: "sidebar",
        paper: "a4",
        accent: "#c2410c",
        headingFont: "playfair-display",
        font: "inter",
        size: "medium",
        spacing: "standard",
        photo: true,
        columns: "auto",
        backdrop: "none",
        backdropColor: "",
      },
    },
    sections: [
      // Cover, quote, links, a mosaic gallery and a timeline.
      {
        id: "ss1",
        title: "Northwell Kitchens",
        description:
          "A cloud-kitchen company running eleven brands out of four Bengaluru facilities.\nFounded 2019, profitable since 2022, forty-two people on payroll.",
        links: [
          { id: "ss1l1", label: "Company", url: "https://example.com/northwell", icon: "globe" },
          { id: "ss1l2", label: "Press kit", url: "https://example.com/press", icon: "document" },
          { id: "ss1l3", label: "Book a tasting", url: "https://example.com/book", icon: "calendar" },
        ],
        images: [
          pic("img-ss1-cover", "kitchenPass", "pass.jpg"),
          pic("img-ss1-g1", "biryani", "biryani.jpg"),
          pic("img-ss1-g2", "spices", "spices.jpg"),
          pic("img-ss1-g3", "facility", "facility.jpg"),
          pic("img-ss1-g4", "team", "team.jpg"),
        ],
        quote: { text: "The best biryani that never had a dining room.", attribution: "A food critic, Deccan Herald" },
        blocks: [
          { id: "ss1b1", type: "gallery", onResume: false, title: "In the kitchens", layout: "mosaic", imageIds: ["img-ss1-g1", "img-ss1-g2", "img-ss1-g3", "img-ss1-g4"] },
          {
            id: "ss1b2",
            type: "timeline",
            onResume: false,
            title: "How it grew",
            items: [
              { id: "ss1t1", date: "2019", title: "One kitchen, two brands", text: "A rented facility in HSR Layout." },
              { id: "ss1t2", date: "2021", title: "Four facilities", text: "Expanded across the city without outside money." },
              { id: "ss1t3", date: "2022", title: "Profitable", text: "Every brand pays for itself." },
              { id: "ss1t4", date: "2026", title: "Eleven brands", text: "And a training kitchen of our own." },
            ],
          },
        ],
      },
      // The two other gallery layouts.
      {
        id: "ss2",
        title: "Photographs",
        description: "The same pictures as a grid, then as a strip a visitor swipes along.",
        links: [],
        onResume: false,
        images: [
          pic("img-ss2-cover", "coldChain", "truck.jpg"),
          pic("img-ss2-g1", "school", "school.jpg"),
          pic("img-ss2-g2", "letter", "letter.jpg"),
          pic("img-ss2-g3", "biryani", "biryani-2.jpg"),
          pic("img-ss2-s1", "facility", "facility-2.jpg"),
          pic("img-ss2-s2", "spices", "spices-2.jpg"),
          pic("img-ss2-s3", "team", "team-2.jpg"),
          pic("img-ss2-s4", "kitchenPass", "pass-2.jpg"),
        ],
        blocks: [
          { id: "ss2b1", type: "gallery", onResume: false, title: "Grid", layout: "grid", imageIds: ["img-ss2-g1", "img-ss2-g2", "img-ss2-g3"] },
          { id: "ss2b2", type: "gallery", onResume: false, title: "Strip", layout: "strip", imageIds: ["img-ss2-s1", "img-ss2-s2", "img-ss2-s3", "img-ss2-s4"] },
        ],
      },
      // The resume's lists, one look each.
      {
        id: "ss3",
        title: "Experience",
        description: "",
        links: [],
        onResume: true,
        blocks: [{ id: "ss3b1", type: "experience", onResume: true, title: "Roles", look: "timeline" }],
      },
      {
        id: "ss4",
        title: "Education and credentials",
        description: "",
        links: [],
        onResume: true,
        blocks: [
          { id: "ss4b1", type: "education", onResume: true, title: "Education", look: "grid" },
          { id: "ss4b2", type: "certifications", onResume: true, title: "Certifications", look: "list" },
          { id: "ss4b3", type: "awards", onResume: true, title: "Awards", look: "spotlight" },
        ],
      },
      {
        id: "ss5",
        title: "Skills and languages",
        description: "",
        links: [],
        onResume: true,
        blocks: [
          { id: "ss5b1", type: "skills", onResume: true, title: "Skills", look: "chips" },
          { id: "ss5b2", type: "languages", onResume: true, title: "Languages", look: "carousel" },
        ],
      },
      // Services, numbers, tabs and questions.
      {
        id: "ss6",
        title: "Advisory practice",
        description:
          "SEBI-registered, fee-only adviser to sixty households. No commissions and no product sales.",
        images: [pic("img-ss6-cover", "letter", "letter-cover.jpg")],
        links: [{ id: "ss6l1", label: "How it works", url: "https://example.com/advisory", icon: "document" }],
        blocks: [
          {
            id: "ss6b1",
            type: "services",
            onResume: false,
            title: "What I offer",
            items: [
              { id: "ss6v1", title: "Financial plan", text: "A written plan for your household, in two sessions.", price: "₹45,000 one-time" },
              { id: "ss6v2", title: "Ongoing advice", text: "Quarterly reviews and a line for the questions in between.", price: "₹90,000 a year" },
              { id: "ss6v3", title: "Second opinion", text: "One session on something you already hold.", price: "₹8,000" },
            ],
          },
          {
            id: "ss6b2",
            type: "stats",
            onResume: false,
            title: "The practice in numbers",
            items: [
              { id: "ss6n1", value: "60", label: "Households" },
              { id: "ss6n2", value: "0", label: "Commissions" },
              { id: "ss6n3", value: "4", label: "New families a year" },
            ],
          },
          {
            id: "ss6b3",
            type: "tabs",
            onResume: false,
            title: "How it works",
            items: [
              { id: "ss6a1", label: "First call", text: "Thirty minutes, free, to see whether I am the right adviser." },
              { id: "ss6a2", label: "The plan", text: "Two sessions and a written plan within three weeks." },
              { id: "ss6a3", label: "After", text: "You implement; I never hold your money. Reviews every quarter." },
            ],
          },
          {
            id: "ss6b4",
            type: "faq",
            onResume: false,
            title: "Questions",
            items: [
              { id: "ss6f1", question: "Do you earn commissions?", answer: "No. The fee is the whole of what I earn." },
              { id: "ss6f2", question: "Do you work outside Bengaluru?", answer: "Yes, most sessions are on video." },
              { id: "ss6f3", question: "Is there a minimum?", answer: "No minimum portfolio size." },
            ],
          },
        ],
      },
      // Testimonials and clients.
      {
        id: "ss7",
        title: "What people say",
        description: "Families, restaurants and editors I have worked with.",
        links: [],
        onResume: false,
        blocks: [
          {
            id: "ss7b1",
            type: "testimonials",
            onResume: false,
            title: "Kind words",
            items: [
              { id: "ss7q1", quote: "He told us not to buy the policy our bank was pushing. That saved us lakhs.", name: "Priya S.", role: "Advisory client" },
              { id: "ss7q2", quote: "Meridian made cold storage something a twelve-table restaurant can afford.", name: "Arjun K.", role: "Owner, Tiffin House" },
              { id: "ss7q3", quote: "The only newsletter about money my parents finish.", name: "Meera N.", role: "Subscriber" },
            ],
          },
          {
            id: "ss7b2",
            type: "clients",
            onResume: false,
            title: "Worked with",
            items: [
              { id: "ss7c1", name: "Tiffin House", url: "https://example.com/tiffin" },
              { id: "ss7c2", name: "Halcyon Capital", url: "" },
              { id: "ss7c3", name: "Sanjeevani Trust", url: "https://example.com/trust" },
              { id: "ss7c4", name: "Deccan Herald", url: "" },
              { id: "ss7c5", name: "Swiggy", url: "" },
              { id: "ss7c6", name: "Zomato", url: "" },
            ],
          },
        ],
      },
      // A plain section: no components, just the section fields.
      {
        id: "ss8",
        title: "Trustee, Sanjeevani Schools Trust",
        description: "On the board of a trust running three low-fee schools in north Karnataka. I chair the finance committee.",
        images: [pic("img-ss8-cover", "school", "school-cover.jpg")],
        links: [{ id: "ss8l1", label: "Trust", url: "https://example.com/trust", icon: "globe" }],
      },
      // On the resume, off the page.
      {
        id: "ss9",
        title: "Draft: a section kept off the page",
        description: "Hidden sections stay in the editor and off the published page. This one still prints on the resume.",
        links: [],
        hidden: true,
      },
      {
        id: "ss10",
        title: "Work with me",
        description: "Advisory, speaking or a conversation about the businesses. I answer within two working days.",
        links: [],
        onResume: false,
        blocks: [
          {
            id: "ss10b1",
            type: "contact",
            onResume: false,
            title: "Get in touch",
            text: "Write a line about what you need and I will come back with a time.",
            email: "rohan@example.com",
            phone: "+91 98450 12345",
            location: "Indiranagar, Bengaluru",
            ctaLabel: "Book an intro call",
            ctaUrl: "https://example.com/book",
            form: true,
          },
        ],
      },
    ],
    footer: {
      headline: "Let’s talk about your money, or your kitchen.",
      text: "Four new advisory families a year, and a standing coffee for anyone building a food business.",
      ctaLabel: "Email Rohan",
      ctaUrl: "mailto:rohan@example.com",
      links: [
        { id: "sf1", label: "The letter", url: "https://example.substack.com" },
        { id: "sf2", label: "Instagram", url: "https://instagram.com/example" },
      ],
      note: "© 2026 Rohan Mehta · Sample data",
      showHeaderLinks: true,
    },
  },
];

export const SEED_PORTFOLIOS: Portfolio[] = RAW.map((p) => normalize(p as Portfolio));
