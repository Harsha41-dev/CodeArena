import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MessageSquarePlus, ThumbsDown, ThumbsUp, UserRound } from "lucide-react";
import { socialApi } from "../services/api";
import { Button } from "../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { TagBadge } from "../components/TagBadge";
import { useAuthStore } from "../stores/authStore";
import { formatDateTime } from "../lib/derivedStats";

export function DiscussionDetailPage() {
  const { id = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const discussion = useQuery({
    queryKey: ["discussion", id],
    queryFn: () => socialApi.getDiscussion(id),
    enabled: Boolean(id)
  });

  const addComment = useMutation({
    mutationFn: () => socialApi.addComment(id, comment),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["discussion", id] });
    }
  });

  const vote = useMutation({
    mutationFn: (value: 1 | -1) => socialApi.voteDiscussion(id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussion", id] });
    }
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }
    if (!comment.trim()) {
      return;
    }
    addComment.mutate();
  }

  function handleUpvote() {
    if (!user) {
      return;
    }
    vote.mutate(1);
  }

  function handleDownvote() {
    if (!user) {
      return;
    }
    vote.mutate(-1);
  }

  if (discussion.isLoading) {
    return <LoadingState label="Loading discussion" />;
  }

  if (discussion.isError) {
    return <ErrorState title="Could not load discussion" error={discussion.error} />;
  }

  if (!discussion.data) {
    return <EmptyState title="Discussion not found" />;
  }

  const data = discussion.data;
  const authorName = data.author?.username ?? "community";
  const downvotes = data.downvotes ?? 0;
  const canInteract = Boolean(user) && !vote.isPending;

  return (
    <div className="space-y-5">
      <Link
        to="/discuss"
        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        ← Back to discussions
      </Link>

      <section className="ca-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{data.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" /> {authorName}
              </span>
              <span>{formatDateTime(data.createdAt)}</span>
              {data.tags?.map((tag) => (
                <TagBadge key={tag} label={tag} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!canInteract} onClick={handleUpvote}>
              <ThumbsUp className="h-4 w-4" /> {data.upvotes}
            </Button>
            <Button variant="secondary" disabled={!canInteract} onClick={handleDownvote}>
              <ThumbsDown className="h-4 w-4" /> {downvotes}
            </Button>
          </div>
        </div>
        <div className="mt-5 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <MarkdownRenderer content={data.content} />
        </div>
      </section>

      <section className="ca-panel overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5">
          Comments
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.comments.map((item) => (
            <article key={item.id} className="px-5 py-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">{item.content}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
            </article>
          ))}
          {!data.comments.length ? (
            <div className="p-5">
              <EmptyState title="No comments yet" />
            </div>
          ) : null}
        </div>
      </section>

      <section className="ca-panel p-5">
        <h2 className="font-semibold">Add Comment</h2>
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <textarea
            className="ca-textarea min-h-28 w-full"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <Button type="submit" disabled={!user || addComment.isPending || !comment.trim()}>
            <MessageSquarePlus className="h-4 w-4" /> Comment
          </Button>
          {!user ? <p className="text-xs text-slate-500">Login to comment.</p> : null}
          {addComment.isError ? <ErrorState title="Could not add comment" error={addComment.error} /> : null}
        </form>
      </section>
    </div>
  );
}
