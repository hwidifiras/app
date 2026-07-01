import fs from "node:fs/promises";
import path from "node:path";

import { launch as launchChrome } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const baseUrl = (process.env.SCREEN_READER_AUDIT_BASE_URL || "https://we-discipline.com").replace(/\/$/, "");
const email = process.env.SCREEN_READER_AUDIT_EMAIL?.trim();
const password = process.env.SCREEN_READER_AUDIT_PASSWORD;
const paths = (process.env.SCREEN_READER_AUDIT_PATHS ||
  "/,/attendance/today,/enrollment,/payments/new,/members,/subscriptions,/payments,/sessions,/groups,/coaches,/sports,/subscription-plans,/offers,/settings/club,/settings/data-import,/settings/users,/logs")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const outputPath = process.env.SCREEN_READER_AUDIT_OUTPUT || "";
const screenshotDir = process.env.SCREEN_READER_AUDIT_SCREENSHOT_DIR || "";

if (!email || !password) {
  console.error("SCREEN_READER_AUDIT_EMAIL and SCREEN_READER_AUDIT_PASSWORD are required.");
  process.exit(2);
}

const profiles = [
  { id: "mobile", label: "Mobile", viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } },
  { id: "desktop", label: "Desktop", viewport: { width: 1440, height: 900, isMobile: false, hasTouch: false } },
];

const interactiveSelector = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='checkbox']",
  "[role='switch']",
  "[role='tab']",
  "summary",
].join(",");

const namedInteractiveRoles = new Set([
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

async function captureScreenshot(page, fileName) {
  if (!screenshotDir) return null;
  await fs.mkdir(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

function collectRoles(node, result = []) {
  if (!node) return result;
  result.push({ role: node.role, name: node.name || "", level: node.level ?? null });
  for (const child of node.children || []) collectRoles(child, result);
  return result;
}

async function elementAccessibleInfo(page, handle) {
  const ax = await page.accessibility.snapshot({ root: handle, interestingOnly: false }).catch(() => null);
  const dom = await page.evaluate((el) => {
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
    const htmlLabels =
      "labels" in el && el.labels
        ? Array.from(el.labels)
            .map((label) => label.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ")
        : "";
    const explicitLabel =
      el.id && "CSS" in window && "escape" in CSS
        ? Array.from(document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`))
            .map((label) => label.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ")
        : "";
    const text = el.innerText || el.textContent || "";
    const disabled =
      el.hasAttribute("disabled") ||
      el.getAttribute("aria-disabled") === "true" ||
      (el instanceof HTMLInputElement && el.disabled) ||
      (el instanceof HTMLButtonElement && el.disabled) ||
      (el instanceof HTMLSelectElement && el.disabled) ||
      (el instanceof HTMLTextAreaElement && el.disabled);
    const ariaHidden = el.getAttribute("aria-hidden") === "true" || Boolean(el.closest("[aria-hidden='true']"));
    const inert = el.hasAttribute("inert") || Boolean(el.closest("[inert]"));
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      role: el.getAttribute("role"),
      type: el instanceof HTMLInputElement ? el.type : null,
      href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
      ariaLabel: el.getAttribute("aria-label"),
      ariaLabelledBy: labelledBy,
      labelledByText,
      htmlLabels,
      explicitLabel,
      title: el.getAttribute("title"),
      placeholder: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.placeholder : "",
      alt: el instanceof HTMLImageElement ? el.alt : "",
      text: text.trim().replace(/\s+/g, " ").slice(0, 160),
      disabled,
      ariaHidden,
      inert,
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
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }, handle);

  const name =
    ax?.name ||
    dom?.ariaLabel ||
    dom?.labelledByText ||
    dom?.htmlLabels ||
    dom?.explicitLabel ||
    dom?.title ||
    dom?.placeholder ||
    dom?.alt ||
    dom?.text ||
    "";
  return {
    role: ax?.role || dom?.role || dom?.tag || "unknown",
    name: name.trim(),
    ...dom,
  };
}

async function collectDomSemantics(page) {
  return page.evaluate(() => {
    function isVisible(el) {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity || "1") > 0
      );
    }

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
      .filter(isVisible)
      .map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: heading.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) || "",
      }));

    const ids = new Map();
    for (const el of Array.from(document.querySelectorAll("[id]"))) {
      const id = el.id.trim();
      if (!id) continue;
      ids.set(id, (ids.get(id) || 0) + 1);
    }

    const images = Array.from(document.querySelectorAll("img,[role='img']"))
      .filter(isVisible)
      .map((image) => ({
        tag: image.tagName.toLowerCase(),
        role: image.getAttribute("role"),
        alt: image instanceof HTMLImageElement ? image.getAttribute("alt") : null,
        ariaLabel: image.getAttribute("aria-label"),
        title: image.getAttribute("title"),
        text: image.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) || "",
      }));

    const mainContent = document.getElementById("main-content");
    const main = document.querySelector("main");
    const skipLinks = Array.from(document.querySelectorAll('a[href="#main-content"]')).filter(isVisible);
    const mainContentValid =
      Boolean(mainContent) &&
      Boolean(main) &&
      (mainContent === main || mainContent.contains(main) || main.contains(mainContent));

    return {
      title: document.title,
      lang: document.documentElement.getAttribute("lang"),
      mainCount: document.querySelectorAll("main").length,
      mainContentExists: Boolean(mainContent),
      mainContentValid,
      skipLinkCount: skipLinks.length,
      navCount: document.querySelectorAll("nav").length,
      loginWall: /connexion/i.test(document.body.textContent || "") && location.pathname !== "/login",
      headings,
      duplicateIds: Array.from(ids.entries())
        .filter(([, count]) => count > 1)
        .map(([id, count]) => ({ id, count })),
      images,
    };
  });
}

function evaluateHeadingOrder(headings) {
  const failures = [];
  if (headings.length === 0) failures.push("No visible headings were found.");
  if (!headings.some((heading) => heading.level === 1)) failures.push("No visible h1 was found.");
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current.level - previous.level > 1) {
      failures.push(`Heading jumps from h${previous.level} to h${current.level} near "${current.text}".`);
      break;
    }
  }
  return failures;
}

function summarizeByRole(roles) {
  const summary = {};
  for (const item of roles) {
    summary[item.role] = (summary[item.role] || 0) + 1;
  }
  return summary;
}

async function auditPage(browser, cookies, pagePath, profile) {
  const page = await browser.newPage();
  await page.setViewport(profile.viewport);
  await page.setCookie(...cookies);
  page.setDefaultTimeout(25000);

  const url = `${baseUrl}${normalizePath(pagePath)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#main-content", { timeout: 25000 });
  await delay(800);

  const screenshot = await captureScreenshot(page, `${profile.id}-${slugify(pagePath)}-screen-reader.png`);
  const dom = await collectDomSemantics(page);
  const axTree = await page.accessibility.snapshot({ interestingOnly: false });
  const axRoles = collectRoles(axTree);
  const interactiveHandles = await page.$$(interactiveSelector);
  const interactive = [];
  for (const handle of interactiveHandles) {
    const info = await elementAccessibleInfo(page, handle);
    if (info.visible && !info.inert) interactive.push(info);
    await handle.dispose();
  }

  const visibleControls = interactive.filter((item) => !item.disabled && !item.ariaHidden);
  const unnamedControls = visibleControls.filter(
    (item) =>
      (namedInteractiveRoles.has(item.role) ||
        ["a", "button", "input", "select", "textarea", "summary"].includes(item.tag || "")) &&
      !item.name,
  );
  const ariaHiddenControls = interactive.filter((item) => item.ariaHidden && !item.disabled);
  const imageNameIssues = dom.images.filter((image) => {
    if (image.tag === "img" && image.alt === "") return false;
    return image.tag === "img"
      ? image.alt == null && !image.ariaLabel && !image.title
      : image.role === "img" && !image.ariaLabel && !image.title && !image.text;
  });

  const failures = [
    ...(dom.lang ? [] : ["Document language is missing."]),
    ...(dom.mainCount === 1 ? [] : [`Expected exactly one main landmark, found ${dom.mainCount}.`]),
    ...(dom.mainContentExists ? [] : ['Skip-link target "#main-content" is missing.']),
    ...(dom.mainContentValid ? [] : ['Skip-link target "#main-content" is not connected to the main landmark.']),
    ...(dom.skipLinkCount > 0 ? [] : ['Visible skip link to "#main-content" is missing.']),
    ...(dom.navCount > 0 ? [] : ["No navigation landmark was found."]),
    ...(dom.loginWall ? ["Route appears to show a login wall."] : []),
    ...evaluateHeadingOrder(dom.headings),
    ...(dom.duplicateIds.length ? [`Duplicate id(s) found: ${dom.duplicateIds.map((item) => item.id).join(", ")}.`] : []),
    ...(unnamedControls.length ? [`${unnamedControls.length} visible interactive control(s) have no accessible name.`] : []),
    ...(ariaHiddenControls.length ? [`${ariaHiddenControls.length} visible interactive control(s) sit inside aria-hidden content.`] : []),
    ...(imageNameIssues.length ? [`${imageNameIssues.length} visible image(s) lack accessible alt/name handling.`] : []),
  ];

  await page.close();
  return {
    path: normalizePath(pagePath),
    profile: profile.label,
    url,
    passed: failures.length === 0,
    failures,
    screenshot,
    stats: {
      headings: dom.headings.length,
      h1: dom.headings.filter((heading) => heading.level === 1).length,
      mainCount: dom.mainCount,
      skipLinkCount: dom.skipLinkCount,
      navCount: dom.navCount,
      visibleControls: visibleControls.length,
      unnamedControls: unnamedControls.length,
      ariaHiddenControls: ariaHiddenControls.length,
      imageNameIssues: imageNameIssues.length,
      axRoles: summarizeByRole(axRoles),
    },
    samples: {
      headings: dom.headings.slice(0, 12),
      unnamedControls: unnamedControls.slice(0, 10).map((item) => ({
        role: item.role,
        tag: item.tag,
        id: item.id,
        type: item.type,
        href: item.href,
        text: item.text,
        rect: item.rect,
      })),
      ariaHiddenControls: ariaHiddenControls.slice(0, 10).map((item) => ({
        role: item.role,
        tag: item.tag,
        id: item.id,
        text: item.text,
        rect: item.rect,
      })),
      imageNameIssues: imageNameIssues.slice(0, 10),
    },
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
      process.stdout.write(`Screen-reader semantics ${profile.label} ${normalizePath(pagePath)} ... `);
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
