"use client";

import { ErrorState } from "@/components/ui/page-state";
import { t } from "@/lib/i18n";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <ErrorState error={t("common.unexpectedError")} onRetry={reset} />
    </main>
  );
}
