export class RegisterDto {
  name: string;
  email: string;
  password: string;
  /** Job-catalog position id (frontend). */
  position?: string;
  /** App role (frontend RoleId); defaults to warehouse_operator if absent/invalid. */
  role?: string;
  /** Optional org scoping at registration time. */
  tenantId?: string;
  buildingId?: string;
}
