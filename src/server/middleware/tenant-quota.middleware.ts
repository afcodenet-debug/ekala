import { Request, Response, NextFunction } from 'express';
import { enforceTenantQuota, QuotaResource } from '../services/tenant-quota.service';

export function quotaGuard(resource: QuotaResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId ?? (req.body?.tenant_id ?? req.params?.tenant_id ?? req.query?.tenant_id);
      if (!tenantId) {
        return next();
      }

      const result = await enforceTenantQuota(Number(tenantId), resource);

      if (!result.allowed) {
        const message = result.message || 'Quota exceeded';
        res.setHeader('X-Tenant-Quota-Limit', String(result.limit));
        res.setHeader('X-Tenant-Quota-Used', String(result.current));
        return res.status(403).json({
          error: 'TENANT_QUOTA_EXCEEDED',
          message,
          quota: {
            resource,
            limit: result.limit,
            current: result.current,
          },
        });
      }

      res.setHeader('X-Tenant-Quota-Limit', String(result.limit ?? ''));
      res.setHeader('X-Tenant-Quota-Used', String(result.current));
      next();
    } catch (e: any) {
      console.error('[QuotaGuard]', e);
      next();
    }
  };
}
