"use client";

import { useMemo, useState } from "react";
import {
  MissionPill,
  MissionSurfaceCard,
  missionActionButtonClassName,
  missionMutedTextClassName,
} from "@/components/student/MissionCards";
import type { ActivityRendererProps } from "./activityShared";

type ItemState = { id: string; text: string; correctCategory: string; placedIn: string | null };

const POOL_KEY = "__pool__";

export default function DragAndDropActivity({ step, disabled, onComplete }: ActivityRendererProps) {
  const config = step.dragAndDrop;
  const initialItems = useMemo<ItemState[]>(() => {
    if (!config?.items) return [];
    return config.items.map((item, idx) => ({
      id: `item-${idx}`,
      text: item.text,
      correctCategory: item.correctCategory,
      placedIn: null,
    }));
  }, [config]);

  const [items, setItems] = useState<ItemState[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ correct: number; total: number; score: number } | null>(null);

  if (!config) {
    return (
      <MissionSurfaceCard variant="error" className="p-4 text-sm">
        활동 데이터가 비어 있어요. 학원에 문의해 주세요.
      </MissionSurfaceCard>
    );
  }

  if (config.mode === "match") {
    return (
      <MissionSurfaceCard variant="hint" className="p-4 text-sm leading-6">
        <p className="font-semibold">매칭 모드는 곧 지원 예정이에요.</p>
        <p className="mt-2">지금은 분류(classify) 모드만 풀 수 있어요. 학원에 문의해 주세요.</p>
      </MissionSurfaceCard>
    );
  }

  if (!config.categories || !config.items) {
    return (
      <MissionSurfaceCard variant="error" className="p-4 text-sm">
        분류 데이터가 비어 있어요.
      </MissionSurfaceCard>
    );
  }

  function moveItemTo(itemId: string, target: string | null) {
    setItems((current) => current.map((it) => (it.id === itemId ? { ...it, placedIn: target } : it)));
    setSelectedId(null);
  }

  function handleDrop(target: string | null, ev: React.DragEvent) {
    ev.preventDefault();
    const itemId = ev.dataTransfer.getData("text/item-id");
    if (!itemId) return;
    moveItemTo(itemId, target);
  }

  function handleClickTarget(target: string | null) {
    if (!selectedId) return;
    moveItemTo(selectedId, target);
  }

  function evaluate() {
    let correct = 0;
    for (const item of items) {
      if (item.placedIn && item.placedIn === item.correctCategory) correct += 1;
    }
    const total = items.length;
    const score = Math.round((correct / Math.max(1, total)) * 100);
    setSubmitted({ correct, total, score });
    onComplete({
      correct: correct === total,
      score,
      studentAnswer: JSON.stringify(items.map((i) => ({ id: i.id, text: i.text, placedIn: i.placedIn }))),
    });
  }

  const allPlaced = items.every((i) => i.placedIn !== null);
  const poolItems = items.filter((i) => i.placedIn === null);

  return (
    <div className="space-y-5">
      {config.prompt && (
        <p className={missionMutedTextClassName("whitespace-pre-line break-words text-sm leading-6")}>{config.prompt}</p>
      )}

      <p className={missionMutedTextClassName("text-xs leading-5")}>
        💡 항목을 드래그하거나, 항목을 누른 뒤 카테고리를 클릭해 옮길 수 있어요.
      </p>

      {/* 미분류 풀 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(null, e)}
        onClick={() => handleClickTarget(null)}
        className="rounded-2xl border border-dashed border-[var(--mission-default-border)] bg-[var(--mission-default-bg)] p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mission-default-muted)]">
          미분류 항목 ({poolItems.length})
        </p>
        <div className="mt-3 flex min-h-[64px] flex-wrap gap-2">
          {poolItems.length === 0 ? (
            <p className={missionMutedTextClassName("text-sm")}>모두 분류했어요!</p>
          ) : (
            poolItems.map((item) => (
              <DraggableChip
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                disabled={disabled || submitted !== null}
                onSelect={() => setSelectedId((cur) => (cur === item.id ? null : item.id))}
              />
            ))
          )}
        </div>
      </div>

      {/* 카테고리 박스 */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {config.categories.map((category) => {
          const placedItems = items.filter((i) => i.placedIn === category.id);
          const accent = category.color || "var(--accent)";
          return (
            <div
              key={category.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(category.id, e)}
              onClick={() => handleClickTarget(category.id)}
              className="cursor-pointer rounded-2xl border-2 border-dashed bg-[var(--mission-default-bg)] p-4 transition hover:border-solid"
              style={{ borderColor: accent }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: accent }}>
                  {category.label}
                </p>
                <MissionPill>{placedItems.length}</MissionPill>
              </div>
              <div className="mt-3 flex min-h-[80px] flex-wrap gap-2">
                {placedItems.map((item) => {
                  const result = submitted ? item.correctCategory === category.id : null;
                  return (
                    <DraggableChip
                      key={item.id}
                      item={item}
                      selected={selectedId === item.id}
                      disabled={disabled || submitted !== null}
                      onSelect={(ev) => {
                        ev.stopPropagation();
                        setSelectedId((cur) => (cur === item.id ? null : item.id));
                      }}
                      tone={result === null ? "neutral" : result ? "correct" : "wrong"}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!submitted && (
        <button
          type="button"
          onClick={evaluate}
          disabled={disabled || !allPlaced}
          className={missionActionButtonClassName("primary", "w-full sm:w-auto")}
        >
          제출하기
        </button>
      )}

      {submitted && (
        <MissionSurfaceCard
          variant={submitted.correct === submitted.total ? "success" : "explanation"}
          className="p-4 text-sm"
        >
          <p className="text-base font-semibold">
            {submitted.correct === submitted.total ? "🎉 전부 맞혔어!" : "📝 채점 결과"}
          </p>
          <p className="mt-2">{`${submitted.correct} / ${submitted.total} 정답 · ${submitted.score}점`}</p>
        </MissionSurfaceCard>
      )}
    </div>
  );
}

type ChipTone = "neutral" | "correct" | "wrong";

function DraggableChip({
  item,
  selected,
  disabled,
  onSelect,
  tone = "neutral",
}: {
  item: ItemState;
  selected: boolean;
  disabled?: boolean;
  onSelect: (ev: React.MouseEvent) => void;
  tone?: ChipTone;
}) {
  const toneStyle =
    tone === "correct"
      ? "border-[var(--mission-success-border)] bg-[var(--mission-success-bg)] text-[var(--mission-success-text)]"
      : tone === "wrong"
        ? "border-[var(--mission-error-border)] bg-[var(--mission-error-bg)] text-[var(--mission-error-text)]"
        : selected
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
          : "border-[var(--mission-default-border)] bg-[var(--bg)] text-[var(--text)]";

  return (
    <button
      type="button"
      disabled={disabled}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/item-id", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      className={`min-h-9 cursor-grab rounded-full border px-3 py-1.5 text-sm font-medium transition active:cursor-grabbing ${toneStyle}`}
      data-pool-key={POOL_KEY}
    >
      {item.text}
    </button>
  );
}
