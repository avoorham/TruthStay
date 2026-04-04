import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildFinanceSystemPrompt } from "@/lib/finance/finance-prompt";

export async function POST(request: NextRequest) {
  const secret = process.env.FINANCE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const auth = request.cookies.get("finance_auth");
  if (!auth || auth.value !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { messages: Array<{ role: "user" | "assistant"; content: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4000,
    system: buildFinanceSystemPrompt(),
    messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No response from Claude" }, { status: 500 });
  }

  return NextResponse.json({ text: textBlock.text.trim() });
}
