"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Resetting the demo takes a couple of seconds, so the button says what's happening.
export function StartTourButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Setting up the demo…" : "Start the tour"}
    </Button>
  );
}
