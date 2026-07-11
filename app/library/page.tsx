import { PublicLibraryControls } from "@/components/library/PublicLibraryControls";
import { LibraryWorkflow } from "@/components/library/LibraryWorkflow";

export default function LibraryPage() {
  return (
    <main className="min-h-screen">
      <PublicLibraryControls />
      <LibraryWorkflow />
    </main>
  );
}
