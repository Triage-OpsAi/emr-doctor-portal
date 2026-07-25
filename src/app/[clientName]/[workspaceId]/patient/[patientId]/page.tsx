import { PatientPage } from "@/components/PatientPage";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ clientName: string; workspaceId: string; patientId: string }>;
}) {
  const { clientName, workspaceId, patientId } = await params;
  return <PatientPage clientName={clientName} workspaceId={workspaceId} patientId={patientId} />;
}
