import { cookies } from "next/headers";
import { endTour, goToTourStep } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { TOUR, TOUR_COOKIE } from "@/lib/tour";

// A slim guide under the header while the tour is on: what to do on this step, and a
// button that becomes the next person and opens their page.
export async function TourBar() {
  const raw = (await cookies()).get(TOUR_COOKIE)?.value;
  const index = raw === undefined ? -1 : Number(raw);
  const step = TOUR[index];
  if (!step) return null;
  const isLast = index === TOUR.length - 1;

  return (
    <aside aria-label="Demo tour" className="border-b border-violet-200 bg-violet-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-violet-950">
            Tour · Step {index + 1} of {TOUR.length}: {step.title}
          </p>
          <p className="mt-0.5 text-violet-900">{step.body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {index > 0 && (
            <form action={goToTourStep.bind(null, index - 1)}>
              <Button type="submit" variant="ghost" size="sm" className="text-violet-900 hover:bg-violet-100">
                Back
              </Button>
            </form>
          )}
          <form action={isLast ? endTour.bind(null, true) : goToTourStep.bind(null, index + 1)}>
            <Button type="submit" size="sm">
              {isLast ? "Finish tour" : `Next: ${TOUR[index + 1].title.split(" ")[0]} →`}
            </Button>
          </form>
          {!isLast && (
            <form action={endTour.bind(null, false)}>
              <Button type="submit" variant="ghost" size="sm" className="text-violet-900 hover:bg-violet-100">
                End tour
              </Button>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}
