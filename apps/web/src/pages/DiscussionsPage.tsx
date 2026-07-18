import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MessageCircle, MessageSquarePlus, Search, ThumbsUp, UserRound } from "lucide-react";
import { problemsApi, socialApi } from "../services/api";
import type { Discussion } from "../types/api";
import { Button } from "../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { TagBadge } from "../components/TagBadge";
import { useAuthStore } from "../stores/authStore";
import { formatDateTime } from "../lib/derivedStats";

const POPULAR_TAGS = ["editorial", "debugging", "dp", "graphs", "contest", "beginner"];

export function DiscussionsPage() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const isProblemDiscussion = Boolean(slug);

  const discussions = useQuery({
    queryKey: ["discussions", slug, search],
    queryFn: () => {
      if (isProblemDiscussion) {
        return problemsApi.discussions(slug!);
      }
      // general feed with optional search
      if (search.trim()) {
        return socialApi.listDiscussions({ search: search.trim() });
      }
      return socialApi.listDiscussions(undefined);
    }
  });

  const create = useMutation({
    mutationFn: () => {
      if (isProblemDiscussion) {
        return socialApi.createDiscussion(slug!, { title, content });
      }
      // parse comma-separated tags
      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      return socialApi.createGeneralDiscussion({ title, content, tags: tagList });
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      setTags("");
      queryClient.invalidateQueries({ queryKey: ["discussions"] });
    }
  });

  const visibleDiscussions = useMemo(() => {
    return discussions.data ?? [];
  }, [discussions.data]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }
    if (!title.trim()) {
      return;
    }
    if (!content.trim()) {
      return;
    }
    create.mutate();
  }

  if (discussions.isLoading) {
    return <LoadingState label="Loading discussions" />;
  }

  const pageTitle = isProblemDiscussion ? "Problem Discussions" : "Discuss";
  let pageSubtitle = "General competitive programming threads, study notes, and platform updates.";
  if (isProblemDiscussion) {
    pageSubtitle = `Ask questions and compare approaches for ${slug}.`;
  }

  return (
    <div className="space-y-5">
      <section className="ca-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{pageTitle}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pageSubtitle}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="ca-input w-full pl-9"
              placeholder="Search discussions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {isProblemDiscussion ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700"
              to={`/problems/${slug}`}
            >
              Back to problem
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="ca-panel overflow-hidden">
          <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5">
            Threads
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {discussions.isError ? (
              <div className="p-5">
                <ErrorState title="Could not load discussions" error={discussions.error} />
              </div>
            ) : null}

            {visibleDiscussions.map((discussion) => (
              <DiscussionCard key={discussion.id} discussion={discussion} />
            ))}

            {!visibleDiscussions.length && !discussions.isError ? (
              <div className="p-5">
                <EmptyState title="No discussions found" body="Try a different search or start the first thread." />
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="ca-panel p-5">
            <h2 className="font-semibold">Start Discussion</h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <input
                className="ca-input w-full"
                placeholder="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              {!isProblemDiscussion ? (
                <input
                  className="ca-input w-full"
                  placeholder="Tags, comma separated"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
              ) : null}
              <textarea
                className="ca-textarea min-h-32 w-full"
                placeholder="Use markdown for code snippets and explanation."
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
              <Button type="submit" disabled={!user || create.isPending || !title.trim() || !content.trim()}>
                <MessageSquarePlus className="h-4 w-4" />
                {create.isPending ? "Posting" : "Post"}
              </Button>
              {!user ? <p className="text-xs text-slate-500">Login to post discussions.</p> : null}
              {create.isError ? <ErrorState title="Could not create discussion" error={create.error} /> : null}
            </form>
          </section>

          <section className="ca-panel p-5">
            <h2 className="font-semibold">Popular Tags</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR_TAGS.map((tag) => (
                <TagBadge key={tag} label={tag} />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DiscussionCard({ discussion }: { discussion: Discussion }) {
  const authorName = discussion.author?.username ?? "community";
  const score = discussion.upvotes - (discussion.downvotes ?? 0);
  const commentCount = discussion.comments.length;
  const visibleTags = discussion.tags?.slice(0, 3) ?? [];

  return (
    <article className="px-6 py-5 transition-colors hover:bg-slate-50/50 dark:hover:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/discuss/${discussion.id}`}
              className="font-semibold text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
            >
              {discussion.title}
            </Link>
            {visibleTags.map((tag) => (
              <TagBadge key={tag} label={tag} />
            ))}
          </div>
          <div className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
            <MarkdownRenderer content={discussion.content} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" /> {authorName}
            </span>
            <span>{formatDateTime(discussion.createdAt)}</span>
          </div>
        </div>
        <div className="grid min-w-24 gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center justify-end gap-1">
            <ThumbsUp className="h-4 w-4" /> {score}
          </span>
          <span className="inline-flex items-center justify-end gap-1">
            <MessageCircle className="h-4 w-4" /> {commentCount}
          </span>
        </div>
      </div>
    </article>
  );
}
