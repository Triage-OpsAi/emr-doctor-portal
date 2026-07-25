import { PortalApp } from "@/components/PortalApp";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ clientName: string; workspaceId: string }>;
}) {
  const { clientName, workspaceId } = await params;
  return <PortalApp clientName={clientName} workspaceId={workspaceId} />;
}
