import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { generateEmbedding, entryToText, type ContentEntryInput } from "@/lib/embeddings";
import { contentLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await checkRateLimit(contentLimiter, `content:${user.id}`);
  if (limited) return limited;

  let body: ContentEntryInput & { source_adventure_id: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.type || !body.name || !body.region) {
    return NextResponse.json({ error: "type, name, region required" }, { status: 400 });
  }

  if (!body.source_adventure_id) {
    return NextResponse.json({ error: "source_adventure_id required" }, { status: 400 });
  }

  // Verify the caller owns the adventure they're attributing this content to.
  const adminDb = createAdminClient();
  const { data: adv } = await adminDb
    .from("adventures")
    .select("id")
    .eq("id", body.source_adventure_id)
    .eq("userId", user.id)
    .maybeSingle();

  if (!adv) {
    return NextResponse.json({ error: "Adventure not found or not owned by you" }, { status: 403 });
  }

  // Generate embedding (non-blocking if OpenAI key missing)
  let embedding: number[] | null = null;
  try { embedding = await generateEmbedding(entryToText(body)); } catch { /* no-op */ }

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
