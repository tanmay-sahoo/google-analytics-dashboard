import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        <p className="text-sm text-slate/60">Open a project to configure data sources and metrics.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="card">
            <div className="text-lg font-semibold">{project.name}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate/50">
              {project.timezone} - {project.currency}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
