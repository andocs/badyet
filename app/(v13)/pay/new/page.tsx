import { redirect } from "next/navigation";
import { RaiseWizard } from "@/components/v13/salary/raise-wizard";
import { loadSalary } from "@/lib/salary/load";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Raise or promotion · Bad(yet)" };

export default async function NewEvent({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const supabase = await createClient();
  if (!supabase) redirect("/pay");
  const { kind } = await searchParams;
  const data = await loadSalary(supabase);
  if (!data.input.events.some((e) => e.kind === "start")) redirect("/pay");
  const initialKind = kind === "allowance" || kind === "promotion" || kind === "merit" || kind === "adjustment" ? kind : null;
  return <RaiseWizard input={data.input} thisMonth={data.thisMonth} placeable={data.placeable} initialKind={initialKind} />;
}
