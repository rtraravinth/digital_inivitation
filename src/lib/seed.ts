import {
  normalize,
  type Portfolio,
  type PortfolioHeader,
  type Section,
} from "./types";

/** Optional fields fall back to the defaults in normalize(). */
type Opt = "image" | "file" | "quote" | "hidden";
type SeedSection = Omit<Section, Opt> & Partial<Pick<Section, Opt>>;

type HeaderOpt = "portrait" | "numbers" | "dates";
type SeedHeader = Omit<PortfolioHeader, HeaderOpt> &
  Partial<Pick<PortfolioHeader, HeaderOpt>>;

type SeedPortfolio = Omit<
  Portfolio,
  "theme" | "accent" | "ground" | "groundHex" | "font" | "bodyFont" | "layout" | "sections" | "header"
> &
  Partial<
    Pick<Portfolio, "theme" | "accent" | "ground" | "groundHex" | "font" | "bodyFont" | "layout">
  > & {
    sections: SeedSection[];
    header: SeedHeader;
  };

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
    // The fullest page carries Site: a sticky nav, a numbers band and a
    // timeline all want content behind them, and a seeded set where nothing
    // is on the flagship theme leaves the gallery's "New" badge opening on
    // an empty page.
    theme: "site",
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
    sections: [
      {
        id: "s1",
        title: "Northwell Kitchens",
        description:
          "A cloud-kitchen company running eleven brands out of four Bengaluru facilities. Founded 2019, profitable since 2022, forty-two people on payroll.",
        tab: "Operating",
        links: [
          { id: "s1l1", label: "Company", url: "northwell.in", icon: "globe" },
          { id: "s1l2", label: "Press", url: "northwell.in/press", icon: "document" },
        ],
      },
      {
        id: "s2",
        title: "Meridian Supply Co.",
        description:
          "Cold-chain logistics for small food businesses that cannot afford their own fleet. Started as Northwell's own supply arm and spun out in 2023.",
        tab: "Operating",
        links: [
          { id: "s2l1", label: "Company", url: "meridiansupply.in", icon: "globe" },
        ],
      },
      {
        id: "s3",
        title: "The Slow Compounding letter",
        description:
          "A fortnightly letter on household finance for people who don't work in finance. Eighty-two issues, 14,200 subscribers, no advertising.",
        tab: "Writing",
        links: [
          { id: "s3l1", label: "Read the letter", url: "slowcompounding.in", icon: "globe" },
          { id: "s3l2", label: "Subscribe", url: "slowcompounding.in/join", icon: "globe" },
        ],
        quote: {
          text: "The only letter about money my parents actually finish.",
          attribution: "A subscriber, unprompted",
        },
      },
      {
        id: "s4",
        title: "Advisory practice",
        description:
          "SEBI-registered investment adviser to sixty households, fee-only, no commissions and no product sales. Taking four new families a year.",
        tab: "Advisory",
        links: [
          {
            id: "s4l1",
            label: "How it works",
            url: "slowcompounding.in/advisory",
            icon: "document",
          },
          { id: "s4l2", label: "Book an intro call", url: "cal.com/rohanmehta" },
        ],
      },
      {
        id: "s5",
        title: "The Sunday clinic",
        description:
          "A free money clinic for gig workers, every Sunday morning in Indiranagar. Two hours, no appointment, whatever you want to ask. Running since 2022.",
        tab: "Community",
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
        tab: "Community",
        links: [
          { id: "s6l1", label: "Trust", url: "sanjeevanitrust.org", icon: "globe" },
        ],
      },
    ],
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
        tab: "Operating",
        links: [
          { id: "i1l1", label: "Deck", url: "northwell.in/deck", icon: "document" },
        ],
      },
      {
        id: "i2",
        title: "Meridian Supply Co.",
        description:
          "Cold-chain logistics, spun out of Northwell in 2023. Two hundred and forty customers.",
        tab: "Operating",
        links: [
          { id: "i2l1", label: "Deck", url: "meridiansupply.in/deck", icon: "document" },
        ],
      },
      {
        id: "i3",
        title: "How I work",
        description:
          "Operator first. I stay close to the kitchens and the trucks, and I do not raise for the sake of raising.",
        tab: "How I work",
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
        tab: "Advisory",
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
        tab: "Writing",
        links: [
          { id: "a2l1", label: "Read", url: "slowcompounding.in", icon: "globe" },
        ],
      },
      {
        id: "a3",
        title: "The Sunday clinic",
        description: "Free, every Sunday morning in Indiranagar. No appointment.",
        tab: "Community",
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
    theme: "poster",
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
        tab: "The letter",
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
        tab: "Elsewhere",
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
    theme: "resume",
    header: {
      name: "Rohan Mehta",
      current: "Trustee, Sanjeevani Schools Trust · Chair, finance committee",
      description:
        "I sit on one board and chair its finance committee. I take governance work seriously and I take very little of it.",
      tags: ["Trustee", "Governance"],
      // Résumé draws a numbers row and a timeline. Without these the theme
      // that shows both had the least to show of any seed.
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
        tab: "The trust",
        links: [
          { id: "b1l1", label: "Trust", url: "sanjeevanitrust.org", icon: "globe" },
        ],
      },
      {
        id: "b2",
        title: "What I bring",
        description:
          "Operating experience in a low-margin business, and a reasonable tolerance for reading an audit file end to end.",
        tab: "What I bring",
        links: [],
      },
    ],
  },
];

export const SEED_PORTFOLIOS: Portfolio[] = RAW.map((p) => normalize(p as Portfolio));
