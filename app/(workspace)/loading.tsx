import { LoadingState } from "@/components/ui/page-state";

export default function WorkspaceLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <LoadingState rows={4} />
    </main>
  );
}
