/**
 * IUserProvider - Interface d'abstraction multi-mode pour les utilisateurs (POS staff)
 *
 * Architecture:
 * Frontend → UserService → IUserProvider → Provider selon RuntimeContext
 *
 * Le frontend ne connaît jamais le mode d'exécution.
 */
export interface UserInfo {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  email: string | null;
  role: string;
  is_active: number;
  pin_code?: string | null;
  password_hash?: string | null;
  has_setup_pin?: number;
  remote_id?: number | null;
  tenant_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface IUserProvider {
  getAll(tenantId: number, role?: string): Promise<UserInfo[]>;
  getById(tenantId: number, id: number): Promise<UserInfo | null>;
  create(tenantId: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo>;
  update(tenantId: number, id: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo>;
  delete(tenantId: number, id: number): Promise<boolean>;
  checkHealth(): Promise<boolean>;
}