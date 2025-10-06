import { Suspense } from "react";
import InviteWaitingScreen from "@/components/session/invite-waiting-screen";

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvitePage({ params, searchParams }: Props) {
  const paramsResolved = await params;
  const searchParamsResolved = await searchParams;
  const { code } = paramsResolved;
  const deviceId = Array.isArray(searchParamsResolved?.device)
    ? searchParamsResolved.device[0]
    : searchParamsResolved?.device || "";

  return (
    <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
      <InviteWaitingScreen code={code} deviceId={deviceId} />
    </Suspense>
  );
}
