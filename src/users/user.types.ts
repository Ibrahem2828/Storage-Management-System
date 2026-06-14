export interface SafeUser {
  id: number;
  name: string;
  username: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserRecord extends SafeUser {
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}
