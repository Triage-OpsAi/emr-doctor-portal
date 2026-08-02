import { PatientPage } from "@/components/PatientPage";

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientName: string; workspaceId: string; patientId: string }>;
  searchParams: Promise<{ visit?: string }>;
}) {
  const { clientName, workspaceId, patientId } = await params;
  const { visit } = await searchParams;
  return <PatientPage clientName={clientName} workspaceId={workspaceId} patientId={patientId} visitId={visit} />;
}
