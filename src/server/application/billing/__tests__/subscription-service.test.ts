/**
 * Integration Tests for SubscriptionService (V1.1)
 * 
 * Tests the complete voucher activation flow with database operations.
 */

import { SubscriptionService } from '../services/SubscriptionService';
import { PostgresSubscriptionRepository } from '../../infrastructure/billing/repositories/PostgresSubscriptionRepository';
import { PostgresVoucherRepository } from '../../infrastructure/billing/repositories/PostgresVoucherRepository';
import { PostgresIdempotencyRepository } from '../../infrastructure/billing/repositories/PostgresIdempotencyRepository';
import { db } from '../../../../db/database';

describe('SubscriptionService Integration', () => {
  let service: SubscriptionService;
  let subscriptionRepo: PostgresSubscriptionRepository;
  let voucherRepo: PostgresVoucherRepository;
  let idempotencyRepo: PostgresIdempotencyRepository;

  beforeAll(() => {
    // Initialize repositories
    subscriptionRepo = new PostgresSubscriptionRepository(db);
    voucherRepo = new PostgresVoucherRepository(db);
    idempotencyRepo = new PostgresIdempotencyRepository(db);

    // Initialize service
    service = new SubscriptionService(
      subscriptionRepo,
      voucherRepo,
      idempotencyRepo,
      db
    );
  });

  beforeEach(async () => {
    // Clean up before each test
    await db.query('DELETE FROM idempotency_records WHERE tenant_id LIKE $1', ['test-%']);
    await db.query('DELETE FROM subscriptions WHERE tenant_id LIKE $1', ['test-%']);
    await db.query('DELETE FROM vouchers WHERE code LIKE $1', ['TEST%']);
  });

  describe('activateWithVoucher', () => {
    it('should activate subscription with valid voucher', async () => {
      // Create a test voucher
      const voucher = {
        code: 'TEST123',
        plan: 'basic',
        duration_days: 30,
        status: 'ACTIVE' as const,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        created_at: new Date()
      };
      
      await db.query(
        `INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [voucher.code, voucher.plan, voucher.duration_days, voucher.status, voucher.expires_at, voucher.created_at]
      );

      // Activate subscription
      const result = await service.activateWithVoucher(
        'TEST123',
        'test-tenant-1',
        'idem-key-1'
      );

      expect(result).toBeDefined();
      expect(result.tenant_id).toBe('test-tenant-1');
      expect(result.plan).toBe('basic');
      expect(result.status).toBe('ACTIVE');
      expect(result.activation_source).toBe('voucher');
      expect(result.activation_reference).toBe('TEST123');
    });

    it('should extend active subscription from end_date', async () => {
      // Create existing active subscription
      const now = new Date();
      const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      
      await db.query(
        `INSERT INTO subscriptions (tenant_id, plan, status, start_date, end_date, activation_source, activation_reference, activated_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        ['test-tenant-2', 'basic', 'ACTIVE', now, endDate, 'voucher', 'OLD123', now, now, now]
      );

      // Create voucher
      await db.query(
        `INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TEST456', 'basic', 30, 'ACTIVE', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), new Date()]
      );

      // Activate (should extend)
      const result = await service.activateWithVoucher(
        'TEST456',
        'test-tenant-2',
        'idem-key-2'
      );

      expect(result.status).toBe('ACTIVE');
      
      // Check that end_date was extended (should be ~40 days from now: 10 + 30)
      const expectedEndDate = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const actualEndDate = new Date(result.end_date);
      
      // Allow 1 second tolerance
      expect(Math.abs(actualEndDate.getTime() - expectedEndDate.getTime())).toBeLessThan(1000);
    });

    it('should restart expired subscription from now', async () => {
      // Create expired subscription
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      
      await db.query(
        `INSERT INTO subscriptions (tenant_id, plan, status, start_date, end_date, activation_source, activation_reference, activated_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        ['test-tenant-3', 'basic', 'EXPIRED', pastDate, pastDate, 'voucher', 'OLD789', pastDate, pastDate, pastDate]
      );

      // Create voucher
      await db.query(
        `INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TEST789', 'premium', 30, 'ACTIVE', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), new Date()]
      );

      // Activate (should restart)
      const result = await service.activateWithVoucher(
        'TEST789',
        'test-tenant-3',
        'idem-key-3'
      );

      expect(result.status).toBe('ACTIVE');
      expect(result.plan).toBe('premium');
      
      // Check that end_date is ~30 days from now
      const expectedEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const actualEndDate = new Date(result.end_date);
      
      expect(Math.abs(actualEndDate.getTime() - expectedEndDate.getTime())).toBeLessThan(1000);
    });

    it('should prevent double redemption (race condition)', async () => {
      // Create voucher
      await db.query(
        `INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TEST999', 'basic', 30, 'ACTIVE', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), new Date()]
      );

      // Try to redeem twice simultaneously
      const promises = [
        service.activateWithVoucher('TEST999', 'test-tenant-a', 'idem-a'),
        service.activateWithVoucher('TEST999', 'test-tenant-b', 'idem-b')
      ];

      const results = await Promise.all(promises);

      // One should succeed, one should fail
      const successCount = results.filter(r => r !== null).length;
      expect(successCount).toBe(1);

      // Verify voucher is marked as USED
      const voucherResult = await db.query('SELECT status, tenant_id FROM vouchers WHERE code = $1', ['TEST999']);
      expect(voucherResult.rows[0].status).toBe('USED');
    });

    it('should return idempotency snapshot on SUCCESS hit', async () => {
      // Create voucher
      await db.query(
        `INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TEST111', 'basic', 30, 'ACTIVE', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), new Date()]
      );

      // First activation
      const result1 = await service.activateWithVoucher('TEST111', 'test-tenant-idem', 'idem-111');
      expect(result1).toBeDefined();

      // Second activation with same idempotency key (should return snapshot)
      const result2 = await service.activateWithVoucher('TEST111', 'test-tenant-idem', 'idem-111');
      expect(result2).toBeDefined();
      expect(result2.tenant_id).toBe(result1.tenant_id);
      expect(result2.plan).toBe(result1.plan);
    });

    it('should throw error for invalid voucher code', async () => {
      await expect(
        service.activateWithVoucher('INVALID', 'test-tenant', 'idem-invalid')
      ).rejects.toThrow('INVALID_VOUCHER');
    });

    it('should throw error for expired voucher', async () => {
      // Create expired voucher
      await db.query(
        `INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TESTEXP', 'basic', 30, 'ACTIVE', new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), new Date()] // 10 days ago
      );

      await expect(
        service.activateWithVoucher('TESTEXP', 'test-tenant', 'idem-exp')
      ).rejects.toThrow('INVALID_VOUCHER');
    });
  });

  describe('getStatus', () => {
    it('should return subscription status for tenant', async () => {
      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      await db.query(
        `INSERT INTO subscriptions (tenant_id, plan, status, start_date, end_date, activation_source, activation_reference, activated_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        ['test-tenant-status', 'premium', 'ACTIVE', now, endDate, 'voucher', 'STATUS123', now, now, now]
      );

      const result = await service.getStatus('test-tenant-status');

      expect(result).toBeDefined();
      expect(result?.tenant_id).toBe('test-tenant-status');
      expect(result?.plan).toBe('premium');
      expect(result?.status).toBe('ACTIVE');
    });

    it('should return null for non-existent tenant', async () => {
      const result = await service.getStatus('non-existent-tenant');
      expect(result).toBeNull();
    });
  });
});