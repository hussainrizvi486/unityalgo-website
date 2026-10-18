'use client';

import { ModulePageContent, ModulePageConfig } from '@/components/website/module-page-content';

const config: ModulePageConfig = {
    badge: "Cloud & DevOps",
    heading: "Infrastructure that deploys itself and tells you when it hurts",
    subheading:
        "Scalable cloud architecture, automated deployments and monitoring that surfaces a problem before a customer reports it \u2014 set up properly once, rather than patched every time it breaks.",
    heroImage: '/images/services/cloud-devops.jpg',
    heroAlt: "Server racks in a data centre with patch cabling",
    overviewSubheading: "What changes once your infrastructure is set up properly.",
    overviewOptions: [
        {
            title: "Deployments that are boring",
            description:
                "A release should be a routine event, not a Friday-night operation. Pipelines build, test and ship on every merge, with a rollback that takes seconds rather than a rebuild.",
            image: '/images/services/cloud-devops.jpg',
        },
        {
            title: "Infrastructure written down, not remembered",
            description:
                "Servers, networks and permissions are defined in code and version-controlled. Rebuilding an environment is a command, and nobody has to recall what was clicked in a console last year.",
            image: '/images/services/cloud-devops.jpg',
        },
        {
            title: "Monitoring aimed at causes",
            description:
                "Metrics, logs and traces that answer why something is slow, not just that it is. Alerts are tuned to be worth waking up for \u2014 an alert nobody trusts is worse than none.",
            image: '/images/services/cloud-devops.jpg',
        },
        {
            title: "Cost you can account for",
            description:
                "Right-sized instances, autoscaling where it genuinely helps, and a breakdown of what each part of the system costs to run. Cloud bills grow quietly when nobody is looking at them.",
            image: '/images/services/cloud-devops.jpg',
        },
    ],
    features: [
        "Cloud Architecture",
        "AWS & DigitalOcean",
        "Docker & Containers",
        "Kubernetes Orchestration",
        "CI/CD Pipelines",
        "Infrastructure as Code",
        "Monitoring & Alerting",
        "Log Aggregation",
        "Backup & Disaster Recovery",
        "Security Hardening",
        "Zero-Downtime Deploys",
        "Cost Optimisation",
    ],
    faqItems: [
        {
            question: "Which cloud providers do you work with?",
            answer:
                "Mostly AWS and DigitalOcean, and self-managed VPS estates where that is a better fit. The choice follows your budget, your data-residency requirements and what your team can realistically operate.",
        },
        {
            question: "Can you migrate us without downtime?",
            answer:
                "In most cases, yes \u2014 by running old and new side by side and cutting traffic over once the new environment is proven. Where a short window is unavoidable, we say so up front and schedule it.",
        },
        {
            question: "Do we need Kubernetes?",
            answer:
                "Usually not. It solves problems that appear at a scale most businesses never reach, and it costs real operational effort. We recommend it when it earns its keep, and containers on plain servers when it does not.",
        },
        {
            question: "Who runs it afterwards?",
            answer:
                "Whoever you want. Everything is documented and reproducible so your team can take it over; we also offer a managed arrangement if you would rather not hire for it.",
        },
    ],
    ctaHeading: "Tired of deployments being an event?",
    ctaDescription:
        "We will review your current setup and tell you what is worth changing first \u2014 and what is fine as it is.",
    ctaLabel: "Book an infrastructure review",
};

export const MainContent = () => <ModulePageContent config={config} />;
