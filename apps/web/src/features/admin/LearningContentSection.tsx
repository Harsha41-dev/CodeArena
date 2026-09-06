import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BookOpen, CalendarDays, ListOrdered, Save, Trash2 } from "lucide-react";
import { adminApi, type LearningCollectionPayload } from "../../services/api";
import type { BadgeDefinition, DailyChallenge, LearningCollection, LearningCollectionType, Problem } from "../../types/api";
import { Button } from "../../components/Button";
import { ErrorState, LoadingState } from "../../components/State";
import { NumberInput, PanelTitle, TextArea, TextInput } from "./formFields";

interface LearningContentSectionProps {
  problems: Problem[];
  onToast: (message: string) => void;
}

type Visibility = NonNullable<LearningCollectionPayload["visibility"]>;

interface CollectionFormState {
  type: LearningCollectionType;
  slug: string;
  title: string;
  description: string;
  badge: string;
  dailyUnlockCount: number;
  visibility: Visibility;
  problemIds: string;
}

export function LearningContentSection({ problems, onToast }: LearningContentSectionProps) {
  const queryClient = useQueryClient();
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>({
    type: "CURATED_LIST",
    slug: "",
    title: "",
    description: "",
    badge: "",
    dailyUnlockCount: 1,
    visibility: "PUBLIC",
    problemIds: ""
  });
  const [collectionItemInputs, setCollectionItemInputs] = useState<Record<string, string>>({});
  const [dailyForm, setDailyForm] = useState({
    date: todayInputValue(),
    problemId: "",
    rewardXp: 50
  });
  const [badgeForm, setBadgeForm] = useState({
    key: "",
    name: "",
    description: "",
    icon: "badge",
    triggerType: "manual",
    triggerValue: 1,
    isActive: true
  });

  const collections = useQuery({
    queryKey: ["admin-learning-collections"],
    queryFn: async () => {
      const [problemSets, studyPlans] = await Promise.all([
        adminApi.problemSets({ includePrivate: "true", limit: "50" }),
        adminApi.studyPlans({ includePrivate: "true", limit: "50" })
      ]);
      return [...problemSets, ...studyPlans].sort((left, right) => left.title.localeCompare(right.title));
    }
  });

  const dailyChallenges = useQuery({
    queryKey: ["admin-daily-challenges"],
    queryFn: () => adminApi.dailyChallenges({ limit: "14" })
  });

  const badges = useQuery({
    queryKey: ["admin-badge-definitions"],
    queryFn: () => adminApi.badgeDefinitions(true)
  });

  const createCollection = useMutation({
    mutationFn: async () => {
      const payload = collectionPayload(collectionForm);
      const created =
        collectionForm.type === "CURATED_LIST"
          ? await adminApi.createProblemSet(payload)
          : await adminApi.createStudyPlan(payload);
      const items = parseProblemItems(collectionForm.problemIds);
      if (items.length) {
        await adminApi.setLearningCollectionItems(created.id, items);
      }
      return created;
    },
    onSuccess: (created) => {
      onToast(`${created.title} saved`);
      setCollectionForm((current) => ({ ...current, slug: "", title: "", description: "", badge: "", problemIds: "" }));
      void queryClient.invalidateQueries({ queryKey: ["admin-learning-collections"] });
    }
  });

  const updateCollection = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<LearningCollectionPayload> }) =>
      adminApi.updateLearningCollection(id, payload),
    onSuccess: () => {
      onToast("Learning collection updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-learning-collections"] });
    }
  });

  const updateItems = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      adminApi.setLearningCollectionItems(id, parseProblemItems(value)),
    onSuccess: (_, variables) => {
      onToast("Problem order saved");
      setCollectionItemInputs((current) => ({ ...current, [variables.id]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["admin-learning-collections"] });
    }
  });

  const deleteCollection = useMutation({
    mutationFn: (id: string) => adminApi.deleteLearningCollection(id),
    onSuccess: () => {
      onToast("Learning collection archived");
      void queryClient.invalidateQueries({ queryKey: ["admin-learning-collections"] });
    }
  });

  const upsertDaily = useMutation({
    mutationFn: () =>
      adminApi.upsertDailyChallenge(dailyForm.date, {
        problemId: dailyForm.problemId.trim(),
        rewardXp: dailyForm.rewardXp
      }),
    onSuccess: () => {
      onToast("Daily challenge saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-daily-challenges"] });
    }
  });

  const createBadge = useMutation({
    mutationFn: () =>
      adminApi.createBadgeDefinition({
        ...badgeForm,
        icon: badgeForm.icon.trim() || null
      }),
    onSuccess: (badge) => {
      onToast(`${badge.name} badge saved`);
      setBadgeForm({
        key: "",
        name: "",
        description: "",
        icon: "badge",
        triggerType: "manual",
        triggerValue: 1,
        isActive: true
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-badge-definitions"] });
    }
  });

  const updateBadge = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateBadgeDefinition(id, { isActive }),
    onSuccess: () => {
      onToast("Badge updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-badge-definitions"] });
    }
  });

  const collectionItems = collections.data ?? [];
  const studyPlans = collectionItems.filter((item) => item.type === "STUDY_PLAN");
  const curatedLists = collectionItems.filter((item) => item.type === "CURATED_LIST");
  const selectedDailyProblem = useMemo(
    () => problems.find((problem) => problem.id === dailyForm.problemId.trim()),
    [dailyForm.problemId, problems]
  );

  return (
    <section className="ca-panel overflow-hidden">
      <div className="border-b border-slate-200/80 bg-slate-50/50 px-6 py-5 dark:border-white/10 dark:bg-white/5">
        <PanelTitle icon={BookOpen} title="Learning Content" />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Manage persisted study plans, curated lists, daily challenge picks, and badge definitions.
        </p>
      </div>

      <datalist id="admin-learning-problem-ids">
        {problems.map((problem) => (
          <option key={problem.id} value={problem.id}>
            {problem.title}
          </option>
        ))}
      </datalist>

      {(collections.isError || dailyChallenges.isError || badges.isError) ? (
        <div className="p-5">
          <ErrorState
            title="Learning content failed"
            error={collections.error ?? dailyChallenges.error ?? badges.error}
          />
        </div>
      ) : null}

      {collections.isLoading ? (
        <LoadingState label="Loading learning content" />
      ) : (
        <div className="grid gap-5 p-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4 dark:border-white/10 dark:bg-white/5">
              <PanelTitle icon={ListOrdered} title="Collections" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium">Type</span>
                  <select
                    className="ca-input mt-1 w-full"
                    value={collectionForm.type}
                    onChange={(event) =>
                      setCollectionForm((current) => ({
                        ...current,
                        type: event.target.value as LearningCollectionType
                      }))
                    }
                  >
                    <option value="CURATED_LIST">Curated list</option>
                    <option value="STUDY_PLAN">Study plan</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Visibility</span>
                  <select
                    className="ca-input mt-1 w-full"
                    value={collectionForm.visibility}
                    onChange={(event) =>
                      setCollectionForm((current) => ({
                        ...current,
                        visibility: event.target.value as Visibility
                      }))
                    }
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TextInput
                  label="Title"
                  value={collectionForm.title}
                  onChange={(value) => setCollectionForm((current) => ({ ...current, title: value }))}
                />
                <TextInput
                  label="Slug"
                  value={collectionForm.slug}
                  onChange={(value) => setCollectionForm((current) => ({ ...current, slug: value }))}
                />
              </div>
              <TextArea
                label="Description"
                value={collectionForm.description}
                onChange={(value) => setCollectionForm((current) => ({ ...current, description: value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <TextInput
                  label="Badge key"
                  value={collectionForm.badge}
                  onChange={(value) => setCollectionForm((current) => ({ ...current, badge: value }))}
                />
                <NumberInput
                  label="Daily unlock count"
                  value={collectionForm.dailyUnlockCount}
                  onChange={(value) => setCollectionForm((current) => ({ ...current, dailyUnlockCount: value }))}
                />
              </div>
              <TextArea
                label="Problem IDs in order"
                value={collectionForm.problemIds}
                onChange={(value) => setCollectionForm((current) => ({ ...current, problemIds: value }))}
                rows={4}
              />
              <Button
                className="mt-3"
                disabled={createCollection.isPending || !collectionForm.slug.trim() || !collectionForm.title.trim()}
                onClick={() => createCollection.mutate()}
              >
                <Save className="h-4 w-4" />
                Save Collection
              </Button>
              {createCollection.isError ? <p className="mt-2 text-sm text-rose-600">{createCollection.error.message}</p> : null}
            </div>

            <CollectionList
              title="Study Plans"
              collections={studyPlans}
              itemInputs={collectionItemInputs}
              onItemInput={(id, value) => setCollectionItemInputs((current) => ({ ...current, [id]: value }))}
              onUpdate={updateCollection.mutate}
              onUpdateItems={updateItems.mutate}
              onDelete={deleteCollection.mutate}
            />
            <CollectionList
              title="Curated Lists"
              collections={curatedLists}
              itemInputs={collectionItemInputs}
              onItemInput={(id, value) => setCollectionItemInputs((current) => ({ ...current, [id]: value }))}
              onUpdate={updateCollection.mutate}
              onUpdateItems={updateItems.mutate}
              onDelete={deleteCollection.mutate}
            />
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4 dark:border-white/10 dark:bg-white/5">
              <PanelTitle icon={CalendarDays} title="Daily Challenge" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <TextInput
                  label="Date"
                  value={dailyForm.date}
                  onChange={(value) => setDailyForm((current) => ({ ...current, date: value }))}
                />
                <NumberInput
                  label="Reward XP"
                  value={dailyForm.rewardXp}
                  onChange={(value) => setDailyForm((current) => ({ ...current, rewardXp: value }))}
                />
              </div>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Problem ID</span>
                <input
                  className="ca-input mt-1 w-full"
                  list="admin-learning-problem-ids"
                  value={dailyForm.problemId}
                  onChange={(event) => setDailyForm((current) => ({ ...current, problemId: event.target.value }))}
                />
              </label>
              {selectedDailyProblem ? <p className="mt-2 text-xs text-slate-500">{selectedDailyProblem.title}</p> : null}
              <Button
                className="mt-3"
                disabled={upsertDaily.isPending || !dailyForm.date || !dailyForm.problemId.trim()}
                onClick={() => upsertDaily.mutate()}
              >
                <Save className="h-4 w-4" />
                Save Daily
              </Button>
              {upsertDaily.isError ? <p className="mt-2 text-sm text-rose-600">{upsertDaily.error.message}</p> : null}
              <div className="mt-4 space-y-2">
                {(dailyChallenges.data ?? []).map((challenge) => (
                  <DailyChallengeRow key={challenge.date} challenge={challenge} />
                ))}
                {!dailyChallenges.data?.length ? <p className="text-sm text-slate-500">No daily challenges saved.</p> : null}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4 dark:border-white/10 dark:bg-white/5">
              <PanelTitle icon={BadgeCheck} title="Badges" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <TextInput
                  label="Key"
                  value={badgeForm.key}
                  onChange={(value) => setBadgeForm((current) => ({ ...current, key: value }))}
                />
                <TextInput
                  label="Name"
                  value={badgeForm.name}
                  onChange={(value) => setBadgeForm((current) => ({ ...current, name: value }))}
                />
              </div>
              <TextArea
                label="Description"
                value={badgeForm.description}
                onChange={(value) => setBadgeForm((current) => ({ ...current, description: value }))}
              />
              <div className="grid gap-3 md:grid-cols-3">
                <TextInput
                  label="Icon"
                  value={badgeForm.icon}
                  onChange={(value) => setBadgeForm((current) => ({ ...current, icon: value }))}
                />
                <TextInput
                  label="Trigger"
                  value={badgeForm.triggerType}
                  onChange={(value) => setBadgeForm((current) => ({ ...current, triggerType: value }))}
                />
                <NumberInput
                  label="Trigger value"
                  value={badgeForm.triggerValue}
                  onChange={(value) => setBadgeForm((current) => ({ ...current, triggerValue: value }))}
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={badgeForm.isActive}
                  onChange={(event) => setBadgeForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span>Active badge</span>
              </label>
              <Button
                className="mt-3"
                disabled={createBadge.isPending || !badgeForm.key.trim() || !badgeForm.name.trim()}
                onClick={() => createBadge.mutate()}
              >
                <Save className="h-4 w-4" />
                Save Badge
              </Button>
              {createBadge.isError ? <p className="mt-2 text-sm text-rose-600">{createBadge.error.message}</p> : null}
              <div className="mt-4 space-y-2">
                {(badges.data ?? []).map((badge) => (
                  <BadgeRow
                    key={badge.id}
                    badge={badge}
                    onToggle={() => updateBadge.mutate({ id: badge.id, isActive: !badge.isActive })}
                  />
                ))}
                {!badges.data?.length ? <p className="text-sm text-slate-500">No badges configured.</p> : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CollectionList({
  title,
  collections,
  itemInputs,
  onItemInput,
  onUpdate,
  onUpdateItems,
  onDelete
}: {
  title: string;
  collections: LearningCollection[];
  itemInputs: Record<string, string>;
  onItemInput: (id: string, value: string) => void;
  onUpdate: (value: { id: string; payload: Partial<LearningCollectionPayload> }) => void;
  onUpdateItems: (value: { id: string; value: string }) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4 dark:border-white/10 dark:bg-white/5">
      <PanelTitle icon={ListOrdered} title={title} />
      <div className="mt-4 space-y-3">
        {collections.map((collection) => (
          <div key={collection.id} className="rounded-md bg-white p-3 text-sm dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{collection.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {collection.slug} - {collection.items?.length ?? 0} problems - {collection.visibility}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <select
                  className="ca-input h-8 py-1 text-xs"
                  value={collection.visibility}
                  onChange={(event) =>
                    onUpdate({
                      id: collection.id,
                      payload: { visibility: event.target.value as Visibility }
                    })
                  }
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
                <Button
                  className="h-8 px-2 text-xs"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Archive ${collection.title}?`)) {
                      onDelete(collection.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Archive
                </Button>
              </div>
            </div>
            <textarea
              className="ca-textarea mt-3 min-h-20 w-full font-mono text-xs"
              placeholder={collection.items?.map((item) => item.problemId).join("\n") || "Problem IDs in order"}
              value={itemInputs[collection.id] ?? ""}
              onChange={(event) => onItemInput(collection.id, event.target.value)}
            />
            <Button
              className="mt-2 h-8 px-2 text-xs"
              variant="secondary"
              disabled={!itemInputs[collection.id]?.trim()}
              onClick={() => onUpdateItems({ id: collection.id, value: itemInputs[collection.id] ?? "" })}
            >
              Save Order
            </Button>
          </div>
        ))}
        {!collections.length ? <p className="text-sm text-slate-500">No {title.toLowerCase()} saved.</p> : null}
      </div>
    </div>
  );
}

function DailyChallengeRow({ challenge }: { challenge: DailyChallenge }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{new Date(challenge.date).toLocaleDateString()}</span>
        <span className="text-xs text-slate-500">{challenge.rewardXp ?? 0} XP</span>
      </div>
      <p className="mt-1 truncate text-xs text-slate-500">{challenge.problem?.title ?? "Problem unavailable"}</p>
    </div>
  );
}

function BadgeRow({ badge, onToggle }: { badge: BadgeDefinition; onToggle: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950">
      <div>
        <p className="font-medium">{badge.name}</p>
        <p className="text-xs text-slate-500">
          {badge.key} - {badge.triggerType}
        </p>
      </div>
      <Button className="h-8 px-2 text-xs" variant={badge.isActive ? "secondary" : "ghost"} onClick={onToggle}>
        {badge.isActive ? "Active" : "Inactive"}
      </Button>
    </div>
  );
}

function collectionPayload(form: CollectionFormState): LearningCollectionPayload {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    badge: form.badge.trim() || null,
    dailyUnlockCount: form.dailyUnlockCount,
    visibility: form.visibility
  };
}

function parseProblemItems(value: string): Array<{ problemId: string; order: number }> {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((problemId, index) => ({ problemId, order: index + 1 }));
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}
