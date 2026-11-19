import { TimelineWorkflow } from "@/components/timeline/TimelineWorkflow";
import { TimelineCommentsEnhancer } from "@/components/timeline/TimelineCommentsEnhancer";
import { TimelinePostDeleteEnhancer } from "@/components/timeline/TimelinePostDeleteEnhancer";
import { TimelineCommentDeleteEnhancer } from "@/components/timeline/TimelineCommentDeleteEnhancer";

export default function TimelinePage() {
  return (
    <main className="min-h-screen">
      <TimelineCommentsEnhancer />
      <TimelinePostDeleteEnhancer />
      <TimelineCommentDeleteEnhancer />
      <TimelineWorkflow />
    </main>
  );
}