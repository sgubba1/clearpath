// Turns audit events into plain sentences, e.g. "Dev Patel approved round 2".

type Event = { actorName: string; action: string; detail: string | null; versionNumber: number | null };

export function describeEvent(event: Event): string {
  const who = event.actorName;
  const round = event.versionNumber ? ` round ${event.versionNumber}` : "";
  switch (event.action) {
    case "created":
      return `${who} started this ad`;
    case "prechecked":
      return `Pre-check ran on${round}: ${event.detail?.toLowerCase() ?? "done"}`;
    case "flags_acknowledged":
      return `${who} sent it with open issues: ${event.detail?.replace(/^Sent with \d+ unresolved: /, "") ?? ""}`;
    case "submitted":
      return `${who} submitted it for review`;
    case "resubmitted":
      return `${who} resubmitted it as${round}${event.detail ? `: "${event.detail}"` : ""}`;
    case "review_started":
      return `${who} started reviewing${round}`;
    case "commented":
      return `${who} commented${event.detail === "General note" ? "" : ` ${event.detail?.replace(/^On /, "on ") ?? ""}`}`;
    case "changes_requested":
      return `${who} asked for changes on${round}`;
    case "approved":
      return `${who} approved${round}${event.detail ? `, with ${event.detail.replace(/^Approved with /i, "").replace(/ flags? judged/, (m) => m.replace("flag", "flagged phrase"))}` : ""}`;
    case "rejected":
      return `${who} rejected${round}`;
    case "withdrawn":
      return `${who} pulled it back to edit before review`;
    case "update_requested":
      return `${who} sent it back for an update after a rate change${event.detail ? ` (${event.detail.replace(/^Rates changed: /, "")})` : ""}`;
    case "rule_added":
      return `${who} added the rule "${event.detail?.replace(/ \(team-\d+\)$/, "") ?? ""}"`;
    case "rule_turned_off":
      return `${who} turned off the rule "${event.detail ?? ""}"`;
    case "rule_turned_on":
      return `${who} turned the rule "${event.detail ?? ""}" back on`;
    default:
      return `${who}: ${event.action.replace(/_/g, " ")}`;
  }
}
