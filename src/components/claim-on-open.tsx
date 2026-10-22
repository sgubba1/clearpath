"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { claimReview } from "@/app/queue/actions";

// Marks a waiting item as in review once a reviewer opens it, then refreshes the header status.
export function ClaimOnOpen({ submissionId }: { submissionId: number }) {
  const router = useRouter();
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    claimReview(submissionId).then(() => router.refresh());
  }, [submissionId, router]);

  return null;
}
