import { UserRole } from '../../modules/users/entities/user.entity';

export interface UserScopes {
  buildings?: string[];
  programs?: string[];
  lines?: number[];
  warehouses?: string[];
}

/** Shape signed into every JWT. */
export interface JwtPayload {
  /** User primary key. Standard JWT subject claim. */
  sub: number;
  email: string;
  role: UserRole;
  tenant_id: string | null;
  organization_id: string | null;
  /** Active plant for this session. Null = org-level / multi-plant access. */
  plant_id: string | null;
  permissions: string[] | null;
  scopes: UserScopes | null;
}

/** Shape of `req.user` after JwtStrategy.validate() resolves. */
export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: UserRole;
  tenant_id: string | null;
  organization_id: string | null;
  plant_id: string | null;
  permissions: string[] | null;
  scopes: UserScopes | null;
}
