import { PostDetailWorkflow } from "@/components/timeline/PostDetailWorkflow";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostDetailWorkflow postId={id} />;
}
