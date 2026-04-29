import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProjectsListClient from "@/components/ProjectsListClient";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { projectUsers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Projects</h1>
        <p className="text-sm text-slate/60">Open a project to manage data source connections and fetch logs.</p>
      </div>
      <ProjectsListClient
        projects={projects}
        canDelete={user.role === "ADMIN"}
        canCreate={user.role === "ADMIN"}
      />
    </div>
  );
}
