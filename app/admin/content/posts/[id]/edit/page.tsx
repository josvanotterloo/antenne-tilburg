import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { PostForm } from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit post</h1>
      <PostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          body: post.body,
          coverImage: post.coverImage,
          status: post.status,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
        }}
      />
    </div>
  );
}
