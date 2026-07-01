/**
 * Calculate new end date for subscription activation (V1.1)
 * 
 * Pure function - no side effects, easily testable.
 * Handles both extension and restart scenarios.
 */

import { Subscription } from '../../../domain/billing/subscription/Subscription';

export function calculateNewEndDate(
  existingEndDate: Date | null,
  durationDays: number,
  isActive: boolean
): Date {
  const now = new Date();
  
  // If subscription is active → extend from end_date
  // If expired or new → restart from now
  const baseDate = isActive && existingEndDate ? existingEndDate : now;
  
  return new Date(
    baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000
  );
}

export function decideActivationMode(
  existingSubscription: Subscription | null
): 'activate_new' | 'extend_existing' {
  // If subscription exists AND is active → extend
  // Otherwise → create/restart
  if (existingSubscription && existingSubscription.isActive()) {
    return 'extend_existing';
  } else {
    return 'activate_new';
  }
}