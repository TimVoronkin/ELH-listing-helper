// src/content/universal_json/page_detector.js

export function detectContext() {
    const context = {
        pageType: 'unknown',
        step: null,
        element: null
    };

    const url = window.location.href;

    // 1. Detect Landlord Page
    // Usually has StepMain for landlords
    if (url.includes('/landlords/')) {
        const stepMain = document.querySelector('div[data-sentry-component="StepMain"]');
        if (stepMain) {
            context.pageType = 'landlord';
            context.step = 'StepMain';
            context.element = stepMain;
            return context;
        }
    }

    // 2. Detect Room Page (Often inside listing URL but different components)
    // Priorities Room components first
    const roomComponents = {
        'FeaturesSteps': 'div[data-sentry-component="FeaturesSteps"]',
        'PaymentSteps': 'div[data-sentry-component="PaymentSteps"]',
        'BlockedDatesStep': 'div[data-sentry-component="BlockedDatesStep"]',
        'PhotosStep': 'div[data-sentry-component="PhotosStep"]'
    };

    for (const [stepName, selector] of Object.entries(roomComponents)) {
        const el = document.querySelector(selector);
        if (el) {
            context.pageType = 'room';
            context.step = stepName;
            context.element = el;
            return context;
        }
    }

    // 3. Detect Listing Page
    // If no room components found, check for listing components
    const listingComponents = {
        'StepLocation': 'div[data-sentry-component="StepLocation"]',
        'StepType': 'div[data-sentry-component="StepType"]',
        'StepComodation': 'div[data-sentry-component="StepComodation"]',
        'StepRules': 'div[data-sentry-component="StepRules"]',
        'StepImages': 'div[data-sentry-component="StepImages"]'
    };

    for (const [stepName, selector] of Object.entries(listingComponents)) {
        const el = document.querySelector(selector);
        if (el) {
            context.pageType = 'listing';
            context.step = stepName;
            context.element = el;
            return context;
        }
    }

    return context;
}
