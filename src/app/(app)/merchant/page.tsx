import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MerchantProductsClient from "@/components/MerchantProductsClient";

export default async function MerchantPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user) {
    return null;
  }

  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { projectUsers: { some: { userId: user.id } } },
    include: { dataSources: true },
    orderBy: { createdAt: "desc" }
  });

  const items = projects.map((project) => {
    const merchantId = project.dataSources.find((item) => item.type === "MERCHANT")?.externalId ?? null;
    return {
      id: project.id,
      name: project.name,
      merchantId
    };
  });
  const importedMerchants = await prisma.merchantAccountImport.findMany({
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Merchant Products</h1>
        <p className="text-sm text-slate/60">Import Merchant Center products and review by project.</p>
      </div>
      <MerchantProductsClient
        projects={items}
        importedMerchants={importedMerchants.map((item) => ({ id: item.merchantId, name: item.name }))}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
