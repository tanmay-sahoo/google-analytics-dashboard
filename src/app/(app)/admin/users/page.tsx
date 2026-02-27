import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "@/components/AdminUsersClient";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      menuAccess: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  return (
    <AdminUsersClient initialUsers={users} />
  );
}
