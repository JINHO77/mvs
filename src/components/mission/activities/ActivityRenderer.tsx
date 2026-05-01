"use client";

import { MissionSurfaceCard } from "@/components/student/MissionCards";
import type { ActivityRendererProps } from "./activityShared";
import SelfExplainActivity from "./SelfExplainActivity";
import FillInBlanksActivity from "./FillInBlanksActivity";
import DragAndDropActivity from "./DragAndDropActivity";
import CompareActivity from "./CompareActivity";

export default function ActivityRenderer(props: ActivityRendererProps) {
  switch (props.step.stepType) {
    case "self_explain":
      return <SelfExplainActivity {...props} />;
    case "fill_in_blanks":
      return <FillInBlanksActivity {...props} />;
    case "drag_and_drop":
      return <DragAndDropActivity {...props} />;
    case "compare":
      return <CompareActivity {...props} />;
    default:
      return (
        <MissionSurfaceCard variant="error" className="p-4 text-sm">
          <p className="font-semibold">지원하지 않는 활동 타입이에요: {props.step.stepType}</p>
          <p className="mt-2">새로고침하거나 학원에 문의하세요.</p>
        </MissionSurfaceCard>
      );
  }
}
