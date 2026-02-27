import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      menuAccess: true,
      locale: true,
      theme: true
    }
  });
  if (!user || user.isActive === false) {
    return null;
  }
  return user;
}

export function isAdmin(role?: string) {
  return role === "ADMIN";
}
