import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Workspace } from "@/components/Workspace";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const row = db.prepare("SELECT id, user_id FROM projects WHERE id = ?").get(id) as any;
  if (!row) notFound();
  if (row.user_id !== user.id) notFound();

  return <Workspace projectId={id} />;
}
