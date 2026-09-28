import { NextResponse } from "next/server";
import { hasOnlineSoundSearch } from "../configured";

export function GET() {
	return NextResponse.json({ configured: hasOnlineSoundSearch() });
}
