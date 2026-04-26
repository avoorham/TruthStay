import { NextResponse } from "next/server";
import { getUsers } from "@/lib/queries/users";

export async function GET() {
  try {
    const data = await getUsers();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
