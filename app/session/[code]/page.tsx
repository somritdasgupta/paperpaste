import { Suspense } from "react";
import SessionHeader from "@/components/session/session-header";
import ClipboardInput from "@/components/session/clipboard-input";
import ItemsList from "@/components/session/items-list";
import PairingScreen from "@/components/session/pairing-screen";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

export default async function SessionPage({ params, searchParams }: Props) {
  const { code } = await params;
  const searchParamsResolved = await searchParams;
  const joined = searchParamsResolved?.join === "1";
  const isNew = searchParamsResolved?.new === "1";

  if (!joined) {
    return <PairingScreen code={code} isNew={isNew} />;
  }

  return (
    <main className="flex flex-col min-h-screen w-full">
      <div className="flex-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mx-auto w-full max-w-7xl">
          <SessionHeader code={code} />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6">
        <div className="mx-auto w-full max-w-7xl flex-1 flex flex-col gap-6">
          <section className="flex-none rounded-xl border bg-card p-4 lg:p-6">
            <ClipboardInput code={code} />
          </section>

          <section className="flex-1 rounded-xl border bg-card overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Shared Items
              </h3>
            </div>
            <div className="flex-1 overflow-auto">
              <Suspense
                fallback={
                  <div className="p-4 text-sm text-muted-foreground">
                    Loading items…
                  </div>
                }
              >
                <ItemsList code={code} />
              </Suspense>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
