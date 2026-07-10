/**
 * Tests simples pour RuntimeContext
 * 
 * PHASE 1 : Validation de l'abstraction minimale
 */

import { RuntimeContext } from '../runtime-context';

describe('RuntimeContext', () => {
  beforeEach(() => {
    // Reset le singleton avant chaque test
    RuntimeContext.reset();
  });

  describe('create()', () => {
    it('should create a LOCAL context', () => {
      const ctx = RuntimeContext.create('LOCAL');
      expect(ctx.mode).toBe('LOCAL');
      expect(ctx.isLocal).toBe(true);
      expect(ctx.isCloud).toBe(false);
      expect(ctx.isHybrid).toBe(false);
    });

    it('should create a CLOUD context', () => {
      const ctx = RuntimeContext.create('CLOUD');
      expect(ctx.mode).toBe('CLOUD');
      expect(ctx.isLocal).toBe(false);
      expect(ctx.isCloud).toBe(true);
      expect(ctx.isHybrid).toBe(false);
    });

    it('should create a HYBRID context', () => {
      const ctx = RuntimeContext.create('HYBRID');
      expect(ctx.mode).toBe('HYBRID');
      expect(ctx.isLocal).toBe(false);
      expect(ctx.isCloud).toBe(false);
      expect(ctx.isHybrid).toBe(true);
    });
  });

  describe('getInstance()', () => {
    it('should return a singleton instance', () => {
      const ctx1 = RuntimeContext.getInstance();
      const ctx2 = RuntimeContext.getInstance();
      expect(ctx1).toBe(ctx2);
    });

    it('should create instance with detected mode if not exists', () => {
      const ctx = RuntimeContext.getInstance();
      // Mode détecté depuis app-mode.ts (CLOUD par défaut dans les tests)
      expect(ctx.mode).toBeDefined();
      expect(['LOCAL', 'CLOUD', 'HYBRID']).toContain(ctx.mode);
    });
  });

  describe('toString()', () => {
    it('should return a readable string', () => {
      const ctx = RuntimeContext.create('LOCAL');
      const str = ctx.toString();
      expect(str).toContain('mode=LOCAL');
      expect(str).toContain('isLocal=true');
    });
  });
});