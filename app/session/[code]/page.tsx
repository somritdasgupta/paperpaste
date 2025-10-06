import { Suspense } from "react"
import SessionHeader from "@/components/session/session-header"
import ClipboardInput from "@/components/session/clipboard-input"
import ItemsList from "@/components/session/items-list"
import PairingScreen from "@/components/session/pairing-screen"

type Props = { params: { code: string }; searchParams: { [k: string]: string | string[] | undefined } }

export default async function SessionPage({ params, searchParams }: Props) {
  const code = params.code
  const joined = searchParams?.join === "1"
  const isNew = searchParams?.new === "1"

  if (!joined) {
    return <PairingScreen code={code} isNew={isNew === "1"} />
  }

  return (
    <main className="w-full px-6 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <SessionHeader code={code} />
        <section className="mt-4 rounded-xl border bg-card p-4">
          <ClipboardInput code={code} />
        </section>
        <section className="mt-4 rounded-xl border bg-card p-0">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading items…</div>}>
            <ItemsList code={code} />
          </Suspense>
        </section>
      </div>
    </main>
  )
}
