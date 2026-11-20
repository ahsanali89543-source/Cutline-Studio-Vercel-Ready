import { Studio } from "@/components/studio/Studio";
import { createFileRoute } from "@tanstack/react-router";

type StudioSearch = { template?: string; grade?: string; upload?: string };

export const Route = createFileRoute("/studio")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    template: typeof search.template === "string" ? search.template : undefined,
    grade: typeof search.grade === "string" ? search.grade : undefined,
    upload: typeof search.upload === "string" ? search.upload : undefined,
  }),
  component: StudioRoute,
});

function StudioRoute() {
  const { template, grade, upload } = Route.useSearch();
  return <Studio template={template} grade={grade} autoOpen={upload === "1"} />;
}
