import { LibraryDiscoveryFilters } from "@/components/library/LibraryDiscoveryFilters";
import { LibraryResultsEnhancer } from "@/components/library/LibraryResultsEnhancer";
import { LibraryWorkflow } from "@/components/library/LibraryWorkflow";

export default function LibraryPage() {
  return (
    <main className="min-h-screen">
      <LibraryDiscoveryFilters />
      <LibraryResultsEnhancer />
      <LibraryWorkflow />
    </main>
  );
}
