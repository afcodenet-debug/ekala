/**
 * ITenantRepository - Interface d'accès aux données du domaine Tenant
 *
 * Les repositories sont responsables UNIQUEMENT des accès aux données.
 * Aucune logique métier dans les repositories.
 */
import type { TenantInfo } from '../ITenantProvider';

export interface TenantRecord extends TenantInfo {
  legal_name?: string | null;
  owner_email?: string;
  owner_phone?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  country?: string;
  city?: string | null;
  address?: string | null;
  default_currency?: string;
  default_locale?: string;
  timezone?: string;
  is_provisioned?: number;
  remote_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ITenantRepository {
  /**
   * Récupère un tenant par son slug
   */
  findBySlug(slug: string): Promise<TenantRecord | null>;

  /**
   * Récupère un tenant par son ID
   */
  findById(id: number): Promise<TenantRecord | null>;

  /**
   * Met à jour un tenant
   */
  update(id: number, data: Partial<TenantRecord>): Promise<TenantRecord>;

  /**
   * Vérifie la santé de la source de données
   */
  checkHealth(): Promise<boolean>;
}