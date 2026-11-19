import { LibraryTermsGate } from "@/components/library/LibraryTermsGate";
import { PublicLibraryControls } from "@/components/library/PublicLibraryControls";
import { LibraryWorkflow } from "@/components/library/LibraryWorkflow";

export default function LibraryPage() {
  return (
    <LibraryTermsGate>
      <main className="min-h-screen">
        <PublicLibraryControls />
        <LibraryWorkflow />
      </main>
    </LibraryTermsGate>
  );
}