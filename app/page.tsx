import { TimelineWorkflow } from "@/components/timeline/TimelineWorkflow";
import { TimelineCommentsEnhancer } from "@/components/timeline/TimelineCommentsEnhancer";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <TimelineCommentsEnhancer />
      <TimelineWorkflow />
    </main>
  );
}
