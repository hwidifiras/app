import { NextResponse } from "next/server";

import {
  getMemberDirectoryPage,
  MEMBER_DIRECTORY_PAGE_SIZE,
  type MemberDirectoryPaymentStatus,
  type MemberDirectoryStatus,
} from "@/lib/member-directory";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const MEMBER_STATUSES = new Set<MemberDirectoryStatus>(["ALL", "ACTIVE", "ARCHIVED"]);
const PAYMENT_STATUSES = new Set<MemberDirectoryPaymentStatus>(["ALL", "PAID", "PARTIAL", "UNPAID"]);

function positiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status")?.toUpperCase() as MemberDirectoryStatus | undefined;
  const paymentParam = params.get("payment")?.toUpperCase() as MemberDirectoryPaymentStatus | undefined;

  const result = await getMemberDirectoryPage({
    tenantId: authUser.tenantId,
    page: positiveInteger(params.get("page"), 1),
    pageSize: positiveInteger(params.get("pageSize"), MEMBER_DIRECTORY_PAGE_SIZE),
    query: params.get("q")?.trim() || undefined,
    status: statusParam && MEMBER_STATUSES.has(statusParam) ? statusParam : "ALL",
    paymentStatus: paymentParam && PAYMENT_STATUSES.has(paymentParam) ? paymentParam : "ALL",
    sportId: params.get("sportId")?.trim() || undefined,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
