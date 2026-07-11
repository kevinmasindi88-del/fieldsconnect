import { LibraryDiscoveryFilters } from "@/components/library/LibraryDiscoveryFilters";
import { LibraryWorkflow } from "@/components/library/LibraryWorkflow";

export default function LibraryPage() {
  return (
    <main className="min-h-screen">
      <LibraryDiscoveryFilters />
      <LibraryWorkflow />
    </main>
  );
}
