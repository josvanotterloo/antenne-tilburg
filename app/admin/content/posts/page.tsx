import Link from "next/link";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { t, tCount } from "@/lib/i18n/t";
import { postStatusLabel } from "@/lib/i18n/enum-labels";
import { PostActions } from "@/components/admin/PostActions";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const posts = await db.post.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("posts.title", locale)}</h1>
          <p className="text-sm text-admin-ink-muted">
            {posts.length}{" "}
            {tCount(posts.length, "posts.countSingular", "posts.countPlural", locale)}
          </p>
        </div>
        <Link
          href="/admin/content/posts/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          {t("posts.newButton", locale)}
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          {t("posts.empty", locale)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("posts.colTitle", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("posts.colSlug", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("posts.colStatus", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("posts.colPublished", locale)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("common.actions", locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {posts.map((post) => (
                <tr key={post.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/content/posts/${post.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">{post.slug}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${
                        post.status === "PUBLISHED"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-admin-raised text-admin-ink"
                      }`}
                    >
                      {postStatusLabel(post.status, locale)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <PostActions
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
                      locale={locale}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
