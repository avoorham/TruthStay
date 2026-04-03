import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { generateEmbedding, entryToText, type ContentEntryInput } from "@/lib/embeddings";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ContentEntryInput & { source_adventure_id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.type || !body.name || !body.region) {
    return NextResponse.json({ error: "type, name, region required" }, { status: 400 });
  }

  // Generate embedding (non-blocking if OpenAI key missing)
  let embedding: number[] | null = null;
  try { embedding = await generateEmbedding(entryToText(body)); } catch { /* no-op */ }

  const adminDb = createAdminClient();
  const { data, error } = await adminDb
    .from("content_entries")
    .insert({
      type:                body.type,
      name:                body.name,
      region:              body.region,
      activity_type:       body.activity_type ?? null,
      description:         body.description ?? null,
      data:                body.data ?? {},
      submitted_by:        user.id,
      source_adventure_id: body.source_adventure_id ?? null,
      upvotes:             1,
      embedding:           embedding ? `[${embedding.join(",")}]` : null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Record submitter's first upvote
  await adminDb.from("content_upvotes").insert({ entry_id: data.id, user_id: user.id });

  return NextResponse.json({ id: data.id });
}
