/**
 * IUserRepository - Interface d'accès aux données du domaine User
 *
 * Les repositories sont responsables UNIQUEMENT des accès aux données.
 * Aucune logique métier dans les repositories.
 */
import type { UserInfo } from '../IUserProvider';

export interface IUserRepository {
  getAll(tenantId: number, role?: string): Promise<UserInfo[]>;
  getById(tenantId: number, id: number): Promise<UserInfo | null>;
  create(tenantId: number, data: Partial<UserInfo>): Promise<UserInfo>;
  update(tenantId: number, id: number, data: Partial<UserInfo>): Promise<UserInfo>;
  delete(tenantId: number, id: number): Promise<boolean>;
  checkHealth(): Promise<boolean>;
}