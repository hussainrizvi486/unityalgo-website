'use client';

import { ModulePageContent, ModulePageConfig } from '@/components/website/module-page-content';

/**
 * Tailored Software Development.
 *
 * No pricing table: this is scoped and quoted per engagement, so publishing
 * fixed tiers would be inventing a price list that does not exist.
 */
const config: ModulePageConfig = {
    badge: "Software Development",
    heading: "Software built for how your business actually works",
    subheading:
        "Off-the-shelf tools force your process to fit their assumptions. We design and build software around the way you already operate \u2014 with an architecture that holds up as you grow.",
    heroImage: '/images/services/software-development.jpg',
    heroAlt: "A development team working together around a table of laptops",
    overviewSubheading: "How a custom build actually runs, start to finish.",
    overviewOptions: [
        {
            title: "Start with the problem, not the tech stack",
            description:
                "Every engagement opens with how your business runs today \u2014 where the manual work sits, what breaks at volume, and what a fix is actually worth. The technology follows from that, not the other way round.",
            image: '/images/services/software-development.jpg',
        },
        {
            title: "An architecture that survives growth",
            description:
                "Systems are built to be extended: clear boundaries between modules, a schema that can take new requirements, and no shortcuts that turn into a rewrite eighteen months in.",
            image: '/images/services/software-development.jpg',
        },
        {
            title: "Ship in slices, not big bangs",
            description:
                "Work is delivered in usable increments you can put in front of real users. You see progress every couple of weeks, and change direction while changing direction is still cheap.",
            image: '/images/services/software-development.jpg',
        },
        {
            title: "Handover you can build on",
            description:
                "You get the source, the schema, the deployment scripts and documentation written for whoever comes next. Nothing here is designed to keep you dependent on us.",
            image: '/images/services/software-development.jpg',
        },
    ],
    features: [
        "Discovery & Scoping",
        "Product & UX Design",
        "Backend & API Development",
        "Frontend Engineering",
        "Database Design",
        "Third-Party Integrations",
        "Workflow Automation",
        "AI & LLM Features",
        "Automated Testing",
        "Documentation & Handover",
    ],
    faqItems: [
        {
            question: "How do you price a custom build?",
            answer:
                "After a paid discovery phase that produces a scope, a technical approach and a fixed estimate. Quoting a bespoke system before that work is done produces a number that has to be revised, which helps nobody.",
        },
        {
            question: "Who owns the code?",
            answer:
                "You do \u2014 source, schema, infrastructure configuration and documentation, from the first commit. It lives in your repository, not ours.",
        },
        {
            question: "Can you work with our existing systems?",
            answer:
                "Yes. Most projects involve integrating with something already in place: an ERP, an accounting package, a payment provider or a legacy database. Replacing a working system is a last resort, not a starting point.",
        },
        {
            question: "What happens after launch?",
            answer:
                "Support is arranged separately from the build, so you are not paying for a retainer you do not need. Options run from a warranty period on delivered work to an ongoing agreement with a response time attached.",
        },
    ],
    ctaHeading: "Have a system in mind?",
    ctaDescription:
        "Tell us what your business needs to do that it cannot do today. We will tell you honestly whether custom software is the right answer.",
    ctaLabel: "Start a conversation",
};

export const MainContent = () => <ModulePageContent config={config} />;
