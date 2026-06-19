import { Request, Response, NextFunction } from 'express';
import { hasPermission, type UserRole, PERMISSIONS, ALL_ROLES } from '../../lib/permissions';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: UserRole;
  };
}

const getRoleFromHeaders = (req: Request): string | undefined => {
  return req.headers['x-user-role'] as string | undefined;
};

const isValidRole = (role: string | undefined): role is UserRole => {
  return !!role && (ALL_ROLES as string[]).includes(role);
};

// Middleware to attach authenticated user from role header (mock auth)
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const roleRaw = getRoleFromHeaders(req);

  if (!roleRaw || !isValidRole(roleRaw)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      required: ['any authenticated role'],
      provided: roleRaw
    });
  }

  // Mock user - replace with actual auth
  req.user = { id: 1, role: roleRaw };
  next();
};

// Permission middleware (RBAC)
export const requirePermission = (permission: keyof typeof PERMISSIONS) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const roleRaw = getRoleFromHeaders(req);

    if (!roleRaw || !isValidRole(roleRaw)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: [permission],
        provided: roleRaw
      });
    }

    if (!hasPermission(roleRaw, permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: [permission],
        provided: roleRaw
      });
    }

    req.user = { id: 1, role: roleRaw };
    next();
  };
};

// Middleware to check if user has required role (legacy)
// Supports both JWT auth (req.user.role) and mock header auth (x-user-role)
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // First try to get role from JWT (set by requireTenantScope)
    const jwtRole = req.user?.role;
    
    // Fallback to header (mock auth mode)
    const headerRole = getRoleFromHeaders(req);
    const roleRaw = jwtRole || headerRole;

    if (!roleRaw || !allowedRoles.includes(roleRaw)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        provided: roleRaw
      });
    }

    if (!isValidRole(roleRaw)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        provided: roleRaw
      });
    }

    // Ensure req.user is set (roleRaw is now validated as UserRole)
    if (!req.user) {
      req.user = { id: 1, role: roleRaw };
    }

    next();
  };
};

// Admin and Manager only
export const requireAdminOrManager = requireRole(['admin', 'manager']);

// Admin only
export const requireAdmin = requireRole(['admin']);
