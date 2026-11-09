declare global {
  namespace App {
    interface Locals {
      user: { id: string; username: string; displayName: string; role: 'pic' | 'viewer' | 'admin'; picName: string | null } | null;
    }
  }
}
export {};
