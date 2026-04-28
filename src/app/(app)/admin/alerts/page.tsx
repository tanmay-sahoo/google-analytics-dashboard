import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import NotificationsClient from "@/components/NotificationsClient";

export default async function AdminAlertsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const adminScope = isAdmin(user.role);

  const projects = await prisma.project.findMany({
    where: adminScope ? {} : { projectUsers: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Notifications</h1>
        <p className="text-sm text-slate/60">
          Browse, search, and filter all alert and system notifications.
        </p>
      </div>
      <NotificationsClient isAdminScope={adminScope} projects={projects} />
    </div>
  );
}
