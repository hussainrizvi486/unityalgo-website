'use client';

import { ModulePageContent, ModulePageConfig } from '@/components/website/module-page-content';

const config: ModulePageConfig = {
    badge: "Mobile Development",
    heading: "Apps people keep on the first screen",
    subheading:
        "High-quality iOS and Android applications with interfaces that feel native, performance that holds on mid-range devices, and a release process that does not stall at the store review.",
    heroImage: '/images/services/mobile-development.jpg',
    heroAlt: "A hand holding a phone showing a mobile application dashboard",
    overviewSubheading: "How we build for phones people actually own.",
    overviewOptions: [
        {
            title: "One codebase where it makes sense",
            description:
                "React Native and Flutter cover the great majority of business applications on both platforms from a single codebase. Native is the right call for heavy device integration, and we will say so when it is.",
            image: '/images/services/mobile-development.jpg',
        },
        {
            title: "Tested on the phones people own",
            description:
                "Performance is checked on mid-range Android hardware and older iPhones, not only on a current flagship. That is what most of your users are actually carrying.",
            image: '/images/services/mobile-development.jpg',
        },
        {
            title: "Offline is a requirement, not an edge case",
            description:
                "Connectivity drops. Applications are built to keep working through it and reconcile cleanly when the network returns, rather than showing a spinner until it does.",
            image: '/images/services/mobile-development.jpg',
        },
        {
            title: "Release handled end to end",
            description:
                "Store listings, signing, review submissions and staged rollouts are part of the work. A build that cannot get through review is not finished.",
            image: '/images/services/mobile-development.jpg',
        },
    ],
    features: [
        "React Native",
        "Flutter",
        "Native iOS (Swift)",
        "Native Android (Kotlin)",
        "Offline-First Sync",
        "Push Notifications",
        "In-App Payments",
        "Biometric Authentication",
        "Deep Linking",
        "Analytics & Crash Reporting",
        "App Store Submission",
        "Over-the-Air Updates",
    ],
    faqItems: [
        {
            question: "React Native, Flutter or native?",
            answer:
                "Cross-platform for most business applications \u2014 one codebase, both stores, materially less to maintain. Native when the app leans hard on device hardware, heavy graphics or platform-specific APIs.",
        },
        {
            question: "Do we need an app at all?",
            answer:
                "Often not. If your users are on a desktop for the task, a responsive web application costs less and ships sooner. An app earns its place when you need push notifications, offline use or device hardware.",
        },
        {
            question: "Who owns the store listings?",
            answer:
                "You do. Apps are published under your own Apple and Google accounts, so your company owns the listings, the reviews and the relationship with your users.",
        },
        {
            question: "How are updates handled after launch?",
            answer:
                "Cross-platform builds can take many fixes over the air without a store review. Anything that changes native code goes through a normal release, which we prepare and submit.",
        },
    ],
    ctaHeading: "Thinking about an app?",
    ctaDescription:
        "We will help you work out whether you need one \u2014 and if you do, what the first version should contain.",
    ctaLabel: "Talk to us about mobile",
};

export const MainContent = () => <ModulePageContent config={config} />;
