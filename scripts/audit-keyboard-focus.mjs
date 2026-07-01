import fs from "node:fs/promises";
import path from "node:path";

import { launch as launchChrome } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const baseUrl = (process.env.KEYBOARD_AUDIT_BASE_URL || "https://we-discipline.com").replace(/\/$/, "");
const email = process.env.KEYBOARD_AUDIT_EMAIL?.trim();
const password = process.env.KEYBOARD_AUDIT_PASSWORD;
const paths = (process.env.KEYBOARD_AUDIT_PATHS || "/,/attendance/today,/enrollment,/payments/new,/members,/settings/data-import")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const maxTabs = Number(process.env.KEYBOARD_AUDIT_MAX_TABS || 18);
const outputPath = process.env.KEYBOARD_AUDIT_OUTPUT || "";
const screenshotDir = process.env.KEYBOARD_AUDIT_SCREENSHOT_DIR || "";

if (!email || !password) {
  console.error("KEYBOARD_AUDIT_EMAIL and KEYBOARD_AUDIT_PASSWORD are required.");
  process.exit(2);
}

const profiles = [
  { id: "mobile", label: "Mobile", viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } },
  { id: "desktop", label: "Desktop", viewport: { width: 1440, height: 900, isMobile: false, hasTouch: false } },
];

const namedRoles = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "menuitem",
  "radio",
  "searchbox",
  "switch",
  "tab",
  "textbox",
]);

function normalizePath(pagePath) {
  return pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "root";
}

function splitSetCookieHeader(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,\s]+=)/g).map((cookie) => cookie.trim()).filter(Boolean);
}

function responseCookiePairs(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookieHeader(response.headers.get("set-cookie"));
  return values.map((value) => value.split(";")[0]?.trim()).filter((value) => value?.includes("="));
}

async function authenticate() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Login failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const pairs = responseCookiePairs(response);
  if (pairs.length === 0) throw new Error("Login succeeded but no auth cookie was returned.");

  const hostname = new URL(baseUrl).hostname;
  return pairs.map((pair) => {
    const [name, ...rest] = pair.split("=");
    return {
      name,
      value: rest.join("="),
      domain: hostname,
      path: "/",
      secure: baseUrl.startsWith("https://"),
      httpOnly: name === "gym_auth",
    };
  });
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function activeElementInfo(page) {
  const elementHandle = await page.evaluateHandle(() => document.activeElement);
  const ax = await page.accessibility.snapshot({ root: elementHandle, interestingOnly: false }).catch(() => null);
  const dom = await page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return null;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const labelledBy = el.getAttribute("aria-labelledby");
    const labelledByText = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ")
      : "";
    const text = el.innerText || el.textContent || "";
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
      type: el instanceof HTMLInputElement ? el.type : null,
      role: el.getAttribute("role"),
      ariaLabel: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
      placeholder: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.placeholder : "",
      labelText: labelledByText,
      text: text.trim().replace(/\s+/g, " ").slice(0, 160),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity || "1") > 0,
      focusIndicator:
        (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth || "0") > 0) ||
        style.boxShadow !== "none" ||
        style.transform !== "none",
    };
  });
  await elementHandle.dispose();

  const name = ax?.name || dom?.ariaLabel || dom?.labelText || dom?.title || dom?.placeholder || dom?.text || "";
  const { role: domRole, ...domInfo } = dom ?? {};
  return {
    role: ax?.role || domRole || dom?.tag || "unknown",
    name: name.trim(),
    ...domInfo,
  };
}

async function captureScreenshot(page, fileName) {
  if (!screenshotDir) return null;
  await fs.mkdir(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

function evaluateSequence(sequence) {
  const failures = [];
  const focusedControls = sequence.filter((step) => namedRoles.has(step.role));
  const invisible = sequence.filter((step) => !step.visible);
  const unnamed = focusedControls.filter((step) => !step.name);
  const withoutFocusIndicator = sequence.filter(
    (step) => step.visible && step.id !== "main-content" && !step.focusIndicator,
  );
  const uniqueKeys = new Set(sequence.map((step) => `${step.role}:${step.name}:${step.href || step.id || step.tag}`));

  if (invisible.length > 0) failures.push(`${invisible.length} focused element(s) were not visible.`);
  if (unnamed.length > 0) failures.push(`${unnamed.length} focused control(s) had no accessible name.`);
  if (withoutFocusIndicator.length > Math.max(1, Math.floor(sequence.length * 0.2))) {
    failures.push(`${withoutFocusIndicator.length} focused element(s) lacked a detectable focus indicator.`);
  }
  if (uniqueKeys.size < Math.min(6, sequence.length)) {
    failures.push("Focus did not progress through enough distinct elements.");
  }

  return {
    passed: failures.length === 0,
    failures,
    stats: {
      focusedCount: sequence.length,
      distinctFocusTargets: uniqueKeys.size,
      focusedControls: focusedControls.length,
      invisible: invisible.length,
      unnamed: unnamed.length,
      withoutFocusIndicator: withoutFocusIndicator.length,
    },
  };
}

async function auditPage(browser, cookies, pagePath, profile) {
  const page = await browser.newPage();
  await page.setViewport(profile.viewport);
  await page.setCookie(...cookies);
  page.setDefaultTimeout(20000);

  const url = `${baseUrl}${normalizePath(pagePath)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#main-content", { timeout: 20000 });
  await delay(700);

  await page.keyboard.press("Tab");
  await delay(100);
  const firstFocus = await activeElementInfo(page);
  const skipScreenshot = await captureScreenshot(
    page,
    `${profile.id}-${slugify(pagePath)}-01-skip-focus.png`,
  );
  const skipLinkPassed =
    firstFocus.tag === "a" &&
    firstFocus.href === "#main-content" &&
    /aller au contenu/i.test(firstFocus.name || firstFocus.text || "") &&
    firstFocus.visible &&
    firstFocus.focusIndicator;

  await page.keyboard.press("Enter");
  await delay(150);
  const afterSkip = await activeElementInfo(page);
  const skipTargetPassed = afterSkip.id === "main-content";

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#main-content", { timeout: 20000 });
  await delay(700);

  const sequence = [];
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    await delay(80);
    const info = await activeElementInfo(page);
    sequence.push({ step: index + 1, ...info });
  }
  const sequenceScreenshot = await captureScreenshot(
    page,
    `${profile.id}-${slugify(pagePath)}-02-tab-sequence.png`,
  );

  const sequenceResult = evaluateSequence(sequence);
  const failures = [
    ...(skipLinkPassed ? [] : ["First Tab did not expose the skip link with visible focus."]),
    ...(skipTargetPassed ? [] : ["Skip link did not move focus to #main-content."]),
    ...sequenceResult.failures,
  ];

  await page.close();
  return {
    path: normalizePath(pagePath),
    profile: profile.label,
    url,
    passed: failures.length === 0,
    failures,
    skipLink: { passed: skipLinkPassed, firstFocus, targetPassed: skipTargetPassed, afterSkip },
    sequence: sequence.map((step) => ({
      step: step.step,
      role: step.role,
      name: step.name,
      tag: step.tag,
      id: step.id,
      href: step.href,
      visible: step.visible,
      focusIndicator: step.focusIndicator,
      rect: step.rect,
    })),
    stats: sequenceResult.stats,
    screenshots: { skipFocus: skipScreenshot, tabSequence: sequenceScreenshot },
  };
}

let chrome;
let browser;
try {
  const cookies = await authenticate();
  chrome = await launchChrome({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });

  const results = [];
  for (const pagePath of paths) {
    for (const profile of profiles) {
      process.stdout.write(`Keyboard ${profile.label} ${normalizePath(pagePath)} ... `);
      const result = await auditPage(browser, cookies, pagePath, profile);
      results.push(result);
      console.log(result.passed ? "ok" : `failed (${result.failures.join("; ")})`);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    paths: paths.map(normalizePath),
    maxTabs,
    summary: { total: results.length, passed, failed },
    results,
  };

  const text = JSON.stringify(report, null, 2);
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${text}\n`, "utf8");
  }
  console.log(text);
  if (failed > 0) process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (chrome) {
    try {
      await chrome.kill();
    } catch (error) {
      console.warn(`Chrome cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
