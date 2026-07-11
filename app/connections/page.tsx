import { ConnectionWorkflow } from "@/components/connections/ConnectionWorkflow";
import { ConnectionsHeadingEnhancer } from "@/components/connections/ConnectionsHeadingEnhancer";

export default function ConnectionsPage() {
  return (
    <main className="min-h-screen">
      <ConnectionsHeadingEnhancer />
      <ConnectionWorkflow />
    </main>
  );
}
