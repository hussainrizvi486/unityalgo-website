import { Suspense } from 'react';
import { OnboardingFlow } from '@/components/customer/onboarding-flow';

export default function CustomerOnboardingPage() {
  return <Suspense><OnboardingFlow /></Suspense>;
}
