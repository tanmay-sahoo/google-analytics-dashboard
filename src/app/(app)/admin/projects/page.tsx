import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminProjectsClient from "@/components/AdminProjectsClient";

export default async function AdminProjectsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { projectUsers: true }
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Projects</h1>
        <p className="text-sm text-slate/60">Create projects and assign users.</p>
      </div>
      <AdminProjectsClient initialProjects={projects} users={users} />
    </div>
  );
}
