/**
 * Tests for calculateNewEndDate helper (V1.1)
 */

import { calculateNewEndDate, decideActivationMode } from '../calculateNewEndDate';
import { Subscription } from '../../../../domain/billing/subscription/Subscription';

describe('calculateNewEndDate', () => {
  const now = new Date();

  it('should extend active subscription from end_date', () => {
    const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    
    const result = calculateNewEndDate(endDate, 30, true);
    
    const expected = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should restart expired subscription from now', () => {
    const pastDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    
    const result = calculateNewEndDate(pastDate, 30, false);
    
    const expected = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Allow 1 second tolerance
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('should restart null end_date from now', () => {
    const result = calculateNewEndDate(null, 30, false);
    
    const expected = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('should handle inactive subscription with end_date', () => {
    const endDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    
    const result = calculateNewEndDate(endDate, 30, false);
    
    const expected = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});

describe('decideActivationMode', () => {
  it('should return extend_existing for active subscription', () => {
    const subscription = new Subscription(
      'tenant-123',
      'basic',
      'ACTIVE',
      new Date(),
      new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      'voucher',
      'ABC123',
      new Date(),
      new Date(),
      new Date()
    );
    
    expect(decideActivationMode(subscription)).toBe('extend_existing');
  });

  it('should return activate_new for null subscription', () => {
    expect(decideActivationMode(null)).toBe('activate_new');
  });

  it('should return activate_new for expired subscription', () => {
    const subscription = new Subscription(
      'tenant-123',
      'basic',
      'EXPIRED',
      new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      'voucher',
      'ABC123',
      new Date(),
      new Date(),
      new Date()
    );
    
    expect(decideActivationMode(subscription)).toBe('activate_new');
  });
});