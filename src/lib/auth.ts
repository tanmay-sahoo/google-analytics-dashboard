import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const googleEnabled =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const limit = rateLimit(`signin:${credentials.email.toLowerCase()}`, 10, 60_000);
        if (!limit.ok) {
          throw new Error("RateLimited");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        // Always run a bcrypt compare to keep timing constant whether or not
        // the user exists — mitigates user-enumeration via response-time signal.
        const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8HVc6KQKmFwT7VhB8Cm6tHK6w3I3CG";
        const compareTarget = user?.passwordHash ?? DUMMY_HASH;
        const valid = await bcrypt.compare(credentials.password, compareTarget);

        if (!user) {
          return null;
        }
        if (user.isActive === false) {
          throw new Error("AccountInactive");
        }
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          menuAccess: user.menuAccess,
          locale: user.locale,
          theme: user.theme
        } as const;
      }
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
          })
        ]
      : [])
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/signin"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.isActive = (user as { isActive?: boolean }).isActive ?? true;
        token.menuAccess = (user as { menuAccess?: unknown }).menuAccess ?? null;
        token.locale = (user as { locale?: string }).locale ?? "en";
        token.theme = (user as { theme?: string }).theme ?? "light";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isActive = (token as { isActive?: boolean }).isActive ?? true;
        session.user.menuAccess = (token as { menuAccess?: unknown }).menuAccess ?? null;
        session.user.locale = (token as { locale?: string }).locale ?? "en";
        session.user.theme = (token as { theme?: string }).theme ?? "light";
      }
      return session;
    }
  }
};
