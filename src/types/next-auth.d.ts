import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      isActive?: boolean;
      menuAccess?: unknown;
      locale?: string;
      theme?: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isActive?: boolean;
    menuAccess?: unknown;
    locale?: string;
    theme?: string;
  }
}
