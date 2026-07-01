import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.AUDIT_BASE_URL || "https://we-discipline.com").replace(/\/$/, "");
const prefix = process.env.AUDIT_PREFIX || "audit-ux";
const email = process.env.AUDIT_ADMIN_EMAIL || `${prefix}@we-discipline.test`;
const password = process.env.AUDIT_ADMIN_PASSWORD;
const outputPath = process.env.AUDIT_OUTPUT || "";

if (!password) {
  console.error("AUDIT_ADMIN_PASSWORD is required.");
  process.exit(2);
}

const ids = {
  memberPaid: `${prefix}-member-paid`,
  memberPartial: `${prefix}-member-partial`,
  memberUnpaid: `${prefix}-member-unpaid`,
  subPartial: `${prefix}-sub-partial`,
  payPartial: `${prefix}-pay-partial`,
  sessionToday: `${prefix}-session-today`,
  sessionPast: `${prefix}-session-past`,
};

const cookieJar = new Map();
const results = [];
let createdPaymentId = null;
let pastPaidAttendanceId = null;

function splitSetCookieHeader(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,\s]+=)/g).map((cookie) => cookie.trim()).filter(Boolean);
}

function rememberCookies(response) {
  const headers = response.headers;
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : splitSetCookieHeader(headers.get("set-cookie"));

  for (const value of values) {
    const [pair] = value.split(";");
    const equalsIndex = pair.indexOf("=");
    if (equalsIndex <= 0) continue;
    const name = pair.slice(0, equalsIndex).trim();
    const cookieValue = pair.slice(equalsIndex + 1);
    if (cookieValue === "") cookieJar.delete(name);
    else cookieJar.set(name, cookieValue);
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(route, options = {}) {
  const headers = new Headers(options.headers || {});
  const cookies = cookieHeader();
  if (cookies) headers.set("cookie", cookies);

  let body = options.body;
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || "GET",
    headers,
    body,
    redirect: options.redirect || "follow",
  });
  rememberCookies(response);

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // HTML pages are checked by text.
  }

  return {
    route,
    status: response.status,
    ok: response.ok,
    elapsedMs: Date.now() - startedAt,
    json,
    text,
  };
}

function addResult(name, response, passed, expected, actual, notes = "") {
  results.push({
    name,
    passed,
    status: response?.status ?? null,
    expected,
    actual,
    notes,
  });
}

async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    results.push({
      name,
      passed: false,
      status: null,
      expected: "Scenario should complete without an unhandled error.",
      actual: error instanceof Error ? error.message : String(error),
      notes: "Runner exception",
    });
  }
}

function hasCode(response, code) {
  return response.json?.code === code || response.json?.data?.code === code;
}

function cents(value) {
  return typeof value === "number" ? value : Number.NaN;
}

await check("Unauthenticated /api/auth/me is empty", async () => {
  const response = await request("/api/auth/me");
  addResult(
    "Unauthenticated /api/auth/me is empty",
    response,
    response.status === 200 && response.json?.data === null,
    "200 with data=null before login.",
    JSON.stringify(response.json),
  );
});

await check("Audit admin can log in", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });
  addResult(
    "Audit admin can log in",
    response,
    response.status === 200 && response.json?.data?.email === email && cookieJar.has("gym_auth"),
    "200, audit email returned, and gym_auth cookie set.",
    JSON.stringify({ body: response.json, cookies: [...cookieJar.keys()] }),
  );
});

await check("Authenticated /api/auth/me reloads current user", async () => {
  const response = await request("/api/auth/me");
  addResult(
    "Authenticated /api/auth/me reloads current user",
    response,
    response.status === 200 && response.json?.data?.id === `${prefix}-admin` && response.json?.data?.role === "ADMIN",
    "200 with the current audit admin from the database.",
    JSON.stringify(response.json?.data),
  );
});

await check("Overpayment is rejected before mutation", async () => {
  const response = await request("/api/payments", {
    method: "POST",
    json: {
      memberSubscriptionId: ids.subPartial,
      amount: 3000,
      paymentMethod: "CASH",
      notes: "Audit functional overpayment probe",
    },
  });
  addResult(
    "Overpayment is rejected before mutation",
    response,
    response.status === 409,
    "409 because existing 2000 + 3000 exceeds the 4000 subscription amount.",
    JSON.stringify(response.json),
  );
});

await check("Partial payment can be collected", async () => {
  const response = await request("/api/payments", {
    method: "POST",
    json: {
      memberSubscriptionId: ids.subPartial,
      amount: 500,
      paymentMethod: "CASH",
      notes: "Audit functional payment",
    },
  });
  createdPaymentId = response.json?.data?.id ?? null;
  addResult(
    "Partial payment can be collected",
    response,
    response.status === 201 && response.json?.data?.entryType === "PAYMENT" && cents(response.json?.data?.amount) === 500,
    "201 with a new positive PAYMENT ledger row.",
    JSON.stringify({ id: createdPaymentId, data: response.json?.data }),
  );
});

await check("Payment correction requires a reason", async () => {
  const response = await request("/api/payments", {
    method: "PATCH",
    json: {
      paymentId: ids.payPartial,
      payload: { amount: 1800 },
    },
  });
  addResult(
    "Payment correction requires a reason",
    response,
    response.status === 400,
    "400 validation failure when correctionReason is missing.",
    JSON.stringify(response.json),
  );
});

await check("Payment correction creates a ledger row", async () => {
  const response = await request("/api/payments", {
    method: "PATCH",
    json: {
      paymentId: ids.payPartial,
      payload: {
        amount: 1800,
        paymentMethod: "CASH",
        notes: "Audit functional corrected amount",
        correctionReason: "Audit functional correction",
      },
    },
  });
  addResult(
    "Payment correction creates a ledger row",
    response,
    response.status === 200 &&
      response.json?.data?.entryType === "CORRECTION" &&
      response.json?.data?.correctsPaymentId === ids.payPartial &&
      cents(response.json?.data?.amount) === -200,
    "200 with CORRECTION row linked to the original payment and signed -200 amount.",
    JSON.stringify(response.json?.data),
  );
});

await check("Payment reversal requires a reason", async () => {
  const response = await request("/api/payments", {
    method: "DELETE",
    json: { paymentId: createdPaymentId },
  });
  addResult(
    "Payment reversal requires a reason",
    response,
    response.status === 400,
    "400 when correctionReason is missing.",
    JSON.stringify(response.json),
  );
});

await check("Payment reversal creates a signed ledger row", async () => {
  const response = await request("/api/payments", {
    method: "DELETE",
    json: {
      paymentId: createdPaymentId,
      correctionReason: "Audit functional reversal",
    },
  });
  addResult(
    "Payment reversal creates a signed ledger row",
    response,
    response.status === 200 &&
      response.json?.data?.entryType === "REVERSAL" &&
      response.json?.data?.correctsPaymentId === createdPaymentId &&
      cents(response.json?.data?.amount) === -500,
    "200 with REVERSAL row linked to the created payment and signed -500 amount.",
    JSON.stringify(response.json?.data),
  );
});

await check("Payment audit reasons appear in admin log UI", async () => {
  const response = await request("/logs?q=Audit%20functional");
  const passed =
    response.status === 200 &&
    response.text.includes("Audit functional correction") &&
    response.text.includes("Audit functional reversal");
  addResult(
    "Payment audit reasons appear in admin log UI",
    response,
    passed,
    "Logs page contains the correction and reversal reasons.",
    passed ? "Both reasons found in /logs HTML." : response.text.slice(0, 500),
  );
});

await check("Unpaid normal attendance is rejected", async () => {
  const response = await request("/api/attendances", {
    method: "POST",
    json: {
      sessionId: ids.sessionToday,
      memberId: ids.memberUnpaid,
      status: "PRESENT",
    },
  });
  addResult(
    "Unpaid normal attendance is rejected",
    response,
    response.status === 403 && hasCode(response, "SUBSCRIPTION_UNPAID"),
    "403 SUBSCRIPTION_UNPAID for normal pointage with no payment.",
    JSON.stringify(response.json),
  );
});

await check("Override attendance requires a reason", async () => {
  const response = await request("/api/attendances", {
    method: "POST",
    json: {
      sessionId: ids.sessionToday,
      memberId: ids.memberUnpaid,
      status: "OVERRIDE",
    },
  });
  addResult(
    "Override attendance requires a reason",
    response,
    response.status === 400,
    "400 when OVERRIDE has no overrideReason.",
    JSON.stringify(response.json),
  );
});

await check("Past session cannot finalize while incomplete", async () => {
  const response = await request(`/api/attendances/sessions/${ids.sessionPast}/finalize`, {
    method: "POST",
    json: { action: "finalize" },
  });
  addResult(
    "Past session cannot finalize while incomplete",
    response,
    response.status === 409 && response.json?.code === "SESSION_ATTENDANCE_INCOMPLETE",
    "409 SESSION_ATTENDANCE_INCOMPLETE before all expected active members are pointed.",
    JSON.stringify(response.json),
  );
});

await check("Past paid attendance can be recorded", async () => {
  const response = await request("/api/attendances", {
    method: "POST",
    json: {
      sessionId: ids.sessionPast,
      memberId: ids.memberPaid,
      status: "PRESENT",
    },
  });
  pastPaidAttendanceId = response.json?.data?.id ?? null;
  addResult(
    "Past paid attendance can be recorded",
    response,
    response.status === 201 && response.json?.data?.member?.id === ids.memberPaid,
    "201 for paid member attendance on the past session.",
    JSON.stringify(response.json?.data),
  );
});

await check("Past partial-paid attendance is allowed by club setting", async () => {
  const response = await request("/api/attendances", {
    method: "POST",
    json: {
      sessionId: ids.sessionPast,
      memberId: ids.memberPartial,
      status: "ABSENT",
    },
  });
  addResult(
    "Past partial-paid attendance is allowed by club setting",
    response,
    response.status === 201 && response.json?.data?.member?.id === ids.memberPartial,
    "201 because allowCheckInWithPartialPayment is enabled in the audit club settings.",
    JSON.stringify(response.json?.data),
  );
});

await check("Unpaid exceptional attendance can be recorded with reason", async () => {
  const response = await request("/api/attendances", {
    method: "POST",
    json: {
      sessionId: ids.sessionPast,
      memberId: ids.memberUnpaid,
      status: "OVERRIDE",
      overrideReason: "Audit functional exception",
    },
  });
  addResult(
    "Unpaid exceptional attendance can be recorded with reason",
    response,
    response.status === 201 && response.json?.data?.status === "OVERRIDE",
    "201 OVERRIDE when a manager reason is supplied.",
    JSON.stringify(response.json?.data),
  );
});

await check("Complete past session can be finalized", async () => {
  const response = await request(`/api/attendances/sessions/${ids.sessionPast}/finalize`, {
    method: "POST",
    json: { action: "finalize" },
  });
  addResult(
    "Complete past session can be finalized",
    response,
    response.status === 200 && response.json?.data?.status === "COMPLETED",
    "200 and status COMPLETED after all expected active members are pointed.",
    JSON.stringify(response.json),
  );
});

await check("Finalized attendance cannot be edited without reopening", async () => {
  const response = await request("/api/attendances", {
    method: "PATCH",
    json: {
      attendanceId: pastPaidAttendanceId,
      payload: { status: "ABSENT" },
    },
  });
  addResult(
    "Finalized attendance cannot be edited without reopening",
    response,
    response.status === 409 && hasCode(response, "SESSION_REOPEN_REQUIRED"),
    "409 SESSION_REOPEN_REQUIRED after finalization.",
    JSON.stringify(response.json),
  );
});

await check("Bulk import preview requires temporary mode", async () => {
  const csv = [
    ["Prénom", "Nom", "Type membre", "Téléphone", "Date inscription", "Groupe", "Formule", "Début abonnement", "Fin abonnement", "Montant total", "Déjà payé", "Séances restantes"],
    ["Audit", "Import", "ADULT", "0711110001", "2026-06-01", "Audit UX Adultes", "Audit UX 8 seances", "2026-06-01", "2026-07-01", "40", "0", "8"],
  ].map((row) => row.join(";")).join("\n");
  const formData = new FormData();
  formData.append("action", "preview");
  formData.append("cutoverDate", "2026-06-15");
  formData.append("file", new Blob([csv], { type: "text/csv" }), "audit-import.csv");

  const response = await request("/api/data-import/bulk", {
    method: "POST",
    body: formData,
  });
  addResult(
    "Bulk import preview requires temporary mode",
    response,
    response.status === 409,
    "409 until the reprise mode is explicitly activated.",
    JSON.stringify(response.json),
  );
});

await check("Bulk import mode can be activated", async () => {
  const response = await request("/api/data-import", {
    method: "POST",
    json: { action: "activate" },
  });
  addResult(
    "Bulk import mode can be activated",
    response,
    response.status === 200 && response.json?.data?.active === true,
    "200 with active=true and the temporary import cookie set.",
    JSON.stringify({ body: response.json, cookies: [...cookieJar.keys()] }),
  );
});

await check("Bulk import preview accepts French headers and auto-generates code", async () => {
  const phoneSuffix = String(Date.now()).slice(-6);
  const csv = [
    ["Code membre auto (laisser vide)", "Prénom", "Nom", "Type membre", "Téléphone", "Date inscription", "Groupe", "Formule", "Début abonnement", "Fin abonnement", "Montant total", "Déjà payé", "Séances restantes"],
    ["", "Audit", "Import", "ADULT", `07${phoneSuffix}`, "2026-06-01", "Audit UX Adultes", "Audit UX 8 seances", "2026-06-01", "2026-07-01", "40", "0", "8"],
  ].map((row) => row.join(";")).join("\n");
  const formData = new FormData();
  formData.append("action", "preview");
  formData.append("cutoverDate", "2026-06-15");
  formData.append("file", new Blob([csv], { type: "text/csv" }), "audit-import.csv");

  const response = await request("/api/data-import/bulk", {
    method: "POST",
    body: formData,
  });
  const row = response.json?.data?.rows?.[0];
  addResult(
    "Bulk import preview accepts French headers and auto-generates code",
    response,
    response.status === 200 &&
      response.json?.data?.okRows === 1 &&
      response.json?.data?.errorRows === 0 &&
      typeof row?.externalId === "string" &&
      row.externalId.startsWith("M001-auditimport-"),
    "200 preview with one valid row and generated M001-auditimport-* code.",
    JSON.stringify(response.json?.data),
  );
});

await check("Bulk import mode can be deactivated", async () => {
  const response = await request("/api/data-import", {
    method: "POST",
    json: { action: "deactivate" },
  });
  addResult(
    "Bulk import mode can be deactivated",
    response,
    response.status === 200 && response.json?.data?.active === false,
    "200 with active=false.",
    JSON.stringify(response.json),
  );
});

await check("Logout clears auth", async () => {
  const logout = await request("/api/auth/logout", { method: "POST" });
  const me = await request("/api/auth/me");
  addResult(
    "Logout clears auth",
    me,
    logout.status === 200 && me.status === 200 && me.json?.data === null,
    "Logout returns 200 and the next /api/auth/me has data=null.",
    JSON.stringify({ logout: logout.json, me: me.json, cookies: [...cookieJar.keys()] }),
  );
});

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  prefix,
  email,
  summary: { total: results.length, passed, failed },
  results,
};

const reportText = JSON.stringify(report, null, 2);
if (outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${reportText}\n`, "utf8");
}

console.log(reportText);
if (failed > 0) {
  process.exit(1);
}
