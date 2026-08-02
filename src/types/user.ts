export type UserRole = "USER" | "ADMIN";

export interface UserDTO {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}
