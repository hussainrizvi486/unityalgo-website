'use client';

import { ModulePageContent, ModulePageConfig } from '@/components/website/module-page-content';

/**
 * Web App Development.
 *
 * No pricing table: this is scoped and quoted per engagement, so publishing
 * fixed tiers would be inventing a price list that does not exist.
 */
const config: ModulePageConfig = {
    badge: "Web Development",
    heading: "Web applications that stay fast as they get bigger",
    subheading:
        "Secure, scalable web applications built on a foundation that holds: fast pages, interfaces people work out without training, and an architecture made for long-term growth.",
    heroImage: '/images/services/web-development.jpg',
    heroAlt: "A laptop on a desk showing application source code",
    overviewSubheading: "What goes into a web application that keeps working as it grows.",
    overviewOptions: [
        {
            title: "Performance treated as a feature",
            description:
                "Speed is measured, not assumed: bundle size, server response and real page-load figures are tracked as the application grows. A page that got slower is a bug, and gets handled like one.",
            image: '/images/services/web-development.jpg',
        },
        {
            title: "Interfaces that need no manual",
            description:
                "Screens are designed around the task in front of the person, using patterns they already know from software they use daily. Training should be for your business rules, not for the buttons.",
            image: '/images/services/web-development.jpg',
        },
        {
            title: "Security built in, not bolted on",
            description:
                "Authentication, authorisation and input validation are designed with the feature rather than added afterwards. Access rules are enforced on the server, where a browser cannot argue with them.",
            image: '/images/services/web-development.jpg',
        },
        {
            title: "Built to be handed over",
            description:
                "Consistent structure, meaningful tests and code written to be read by whoever maintains it next \u2014 including the version of your team that exists in two years.",
            image: '/images/services/web-development.jpg',
        },
    ],
    features: [
        "Next.js & React",
        "Django & Python",
        "REST & GraphQL APIs",
        "PostgreSQL & MySQL",
        "Authentication & Roles",
        "Responsive Interfaces",
        "Accessibility (WCAG)",
        "Performance Optimisation",
        "SEO Foundations",
        "Payment Integration",
        "Admin Dashboards",
        "Automated Testing",
    ],
    faqItems: [
        {
            question: "How long does a web application take?",
            answer:
                "A focused first release is typically eight to sixteen weeks depending on scope. We would rather ship something narrow that works and extend it than spend six months before anyone can use anything.",
        },
        {
            question: "Can you take over an existing codebase?",
            answer:
                "Yes. That starts with a short review of the code, the data model and the deployment setup, so you get an honest read on what is worth keeping before anyone commits to a plan.",
        },
        {
            question: "Will it work on mobile browsers?",
            answer:
                "Every interface is built responsive and tested at phone widths. For most business applications a good responsive web app removes the need for a separate mobile build entirely.",
        },
        {
            question: "Do you handle hosting?",
            answer:
                "We can, or we can deploy into infrastructure you already own. Either way the deployment is scripted and documented rather than assembled by hand.",
        },
    ],
    ctaHeading: "Ready to build it properly?",
    ctaDescription:
        "Bring us a rough idea or a detailed specification. We will come back with a scope, a timeline and a straight answer on cost.",
    ctaLabel: "Discuss your project",
};

export const MainContent = () => <ModulePageContent config={config} />;
