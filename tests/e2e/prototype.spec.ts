import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { initialState } from "../../src/features/prototype/model";
import { STORAGE_KEY } from "../../src/features/prototype/storage";
import { readFile } from "node:fs/promises";
async function choose(page: Page, name: string) {
  await page.goto("/#/auth/sign-in");
  await page.getByRole("button", { name: `Wejdź jako ${name}`, exact: true }).click();
}
const ownWork = "Przeprowadziłam 18 wywiadów z użytkownikami i ustaliłam priorytety wdrożenia.";
async function fillOwnWork(page: Page) {
  await page.getByLabel("Mój własny wkład (wymagane)").fill(ownWork);
}
async function application(page: Page) {
  await choose(page, "Anna Kowalska");
  await page.goto("/#/aplikuj/ai-product-manager");
  await fillOwnWork(page);
  await page
    .getByLabel("Dlaczego pasujesz do tej roli?")
    .fill(
      "Zaprojektowałam proces automatyzacji i przeprowadziłam badania użytkowników. Wynik: krótszy czas obsługi zgłoszeń o 30%.",
    );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
}

for (const [name, filename] of [
  ["Anna Kowalska", "anna-kowalska-cv-v1.pdf"],
  ["Marek Nowak", "marek-nowak-cv-v1.pdf"],
]) {
  test(`${name} has the same local PDF in profile, application and employer detail`, async ({
    page,
  }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      if (!request.url().startsWith("http://127.0.0.1:3106")) external.push(request.url());
    });
    await choose(page, name);
    await page.goto("/#/app/profil");
    const downloadLink = page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true });
    const href = await downloadLink.getAttribute("href");
    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const bytes = await response.body();
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const downloaded = page.waitForEvent("download");
    await downloadLink.focus();
    await page.keyboard.press("Enter");
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe(filename);
    expect(await readFile((await download.path())!)).toEqual(bytes);
    await page.getByLabel("Imię i nazwisko").fill(`Zmieniony profil ${name}`);
    await page.getByRole("button", { name: "Zapisz profil", exact: true }).click();
    await page.reload();
    await expect(downloadLink).toHaveAttribute("href", href!);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(downloadLink).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/${filename}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/#/aplikuj/ai-operations-specialist");
    await expect(downloadLink).toHaveAttribute("href", href!);
    await expect(page.getByRole("link", { name: "Otwórz CV (PDF)", exact: false })).toHaveAttribute(
      "target",
      "_blank",
    );
    await fillOwnWork(page);
    await page
      .getByLabel("Dlaczego pasujesz do tej roli?")
      .fill("Mam doświadczenie w rozwoju produktów i automatyzacji obsługi zgłoszeń.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
    await page.getByRole("link", { name: "AI Operations Specialist", exact: true }).click();
    await page.getByRole("tab", { name: "CV", exact: true }).click();
    await expect(downloadLink).toHaveAttribute("href", href!);
    const id = page.url().split("/").pop();
    await choose(page, "Karolina Wiśniewska");
    await page.goto(`/#/app/kandydaci/${id}`);
    await page.reload();
    await expect(downloadLink).toHaveCount(0);
    await page.getByRole("tab", { name: "CV", exact: true }).click();
    await expect(downloadLink).toHaveAttribute("href", href!);
    await page.screenshot({ path: `artifacts/${filename}-employer-desktop.png`, fullPage: true });
    expect(external).toEqual([]);
  });
}

test("published job → saved offer/draft → submitted application → employer decision survives reload", async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:3106") &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await choose(page, "Karolina Wiśniewska");
  await page.getByRole("link", { name: "Dodaj ofertę", exact: true }).click();
  await page.getByLabel("Nazwa stanowiska").fill("Product Designer do automatyzacji");
  await page
    .getByLabel("Brief — kogo szukasz i do jakiego zadania?")
    .fill("Szukamy osoby do badań z klientami, prototypowania i wdrażania automatyzacji obsługi.");
  await page.getByRole("button", { name: "Przygotuj opis z AI" }).click();
  await page.getByRole("button", { name: "Użyj propozycji" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Opublikuj ofertę" }).click();
  await expect(
    page.getByRole("link", { name: "Product Designer do automatyzacji", exact: true }),
  ).toBeVisible();
  await choose(page, "Anna Kowalska");
  await page.goto("/#/oferty");
  await page.getByLabel("Szukaj ofert", { exact: true }).fill("Product Designer do automatyzacji");
  await page.getByRole("button", { name: "Szukaj", exact: true }).click();
  await page.reload();
  await page.getByRole("link", { name: "Product Designer do automatyzacji", exact: true }).click();
  await page.getByRole("button", { name: "Zapisz ofertę", exact: true }).click();
  await page.getByRole("link", { name: "Aplikuj", exact: true }).click();
  const answer = page.getByLabel("Dlaczego pasujesz do tej roli?");
  const draftAnswer =
    "Przeprowadziłam badania z użytkownikami i wdrożyłam automatyzację. Czas obsługi skrócił się o 30%.";
  await expect(page.getByLabel("Twoje notatki do aplikacji (opcjonalnie)")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Przygotuj propozycję z AI" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Użyj propozycji" })).toHaveCount(0);
  await fillOwnWork(page);
  await answer.fill(draftAnswer);
  await page.getByRole("button", { name: "Zapisz szkic" }).click();
  await expect(page.getByRole("status")).toHaveText("Szkic został zapisany.");
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).drafts.at(-1), STORAGE_KEY),
  ).toMatchObject({ notes: "", generated: "", answer: draftAnswer, scopeCard: { ownWork } });
  await page.reload();
  await expect(answer).toHaveValue(draftAnswer);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
  await expect(page.getByText("Aplikacja została wysłana.", { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Product Designer do automatyzacji", exact: true }).click();
  const candidateUrl = page.url();
  await expect(page.getByText("Match Score: 84%", { exact: true })).toBeVisible();
  await choose(page, "Karolina Wiśniewska");
  await page.getByRole("link", { name: "Kandydaci", exact: true }).click();
  await page.getByRole("link", { name: "Anna Kowalska", exact: true }).click();
  await page
    .getByLabel("Notatka rekrutacyjna (widoczna pracodawcy)")
    .fill("Notatka pracodawcy — tylko panel firmy.");
  await page.getByRole("button", { name: "W przeglądzie", exact: true }).click();
  for (const label of ["Zaproszenie na rozmowę", "Pierwsza rozmowa odbyta", "Kolejny etap"])
    await page.getByRole("button", { name: label, exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Zatrudnienie", exact: true })).toBeVisible();
  await choose(page, "Anna Kowalska");
  await page.goto(candidateUrl);
  await expect(page.locator(".record-stage")).toHaveText("Kolejny etap");
  await expect(
    page.getByText("Notatka pracodawcy — tylko panel firmy.", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "artifacts/candidate-desktop.png", fullPage: true });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("another company cannot see or change a candidate application", async ({ page }) => {
  await choose(page, "Tomasz Zieliński");
  await page.goto("/#/app/kandydaci");
  await expect(page.getByRole("link", { name: "Marek Nowak", exact: true })).toHaveCount(0);
  await page.goto("/#/app/kandydaci/application-example");
  await expect(page.getByRole("heading", { name: "Nie znaleziono strony" })).toBeVisible();
});
test("candidate withdrawal is confirmed and terminal", async ({ page }) => {
  await application(page);
  await page.getByRole("link", { name: "AI Product Manager", exact: true }).click();
  await page.getByRole("button", { name: "Wycofaj aplikację", exact: true }).click();
  await page.getByRole("button", { name: "Anuluj", exact: true }).click();
  await expect(page.getByRole("button", { name: "Wycofaj aplikację", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wycofaj aplikację", exact: true }).click();
  await page.getByRole("button", { name: "Potwierdź wycofanie", exact: true }).click();
  await page.reload();
  await expect(page.locator(".record-stage")).toHaveText("Wycofana");
});
test("profile changes do not rewrite a submitted application snapshot", async ({ page }) => {
  await application(page);
  await page.goto("/#/app/profil");
  await page.getByLabel("Imię i nazwisko").fill("Nowa Anna");
  await page.getByRole("button", { name: "Zapisz profil", exact: true }).click();
  await page.goto("/#/app/aplikacje");
  await page.getByRole("link", { name: "AI Product Manager", exact: true }).click();
  await expect(page.locator("main")).toContainText("Anna Kowalska");
});
test("invalid import preserves state, valid import replaces state, reset asks for confirmation", async ({
  page,
}) => {
  await choose(page, "Anna Kowalska");
  await page.goto("/#/app/settings");
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel("Importuj plik scenariusza").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await page.getByRole("button", { name: "Importuj", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Nieprawidłowy plik");
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
  const imported = initialState();
  imported.activePersonId = "candidate-anna";
  imported.people[0].name = "Zaimportowana Anna";
  await page.getByLabel("Importuj plik scenariusza").setInputFiles({
    name: "scenario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page.getByRole("button", { name: "Importuj", exact: true }).click();
  await expect(page.getByText("Zaimportowana Anna", { exact: true }).first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksportuj dane" }).click();
  expect((await download).suggestedFilename()).toBe("doroboty-scenariusz.json");
  await page.getByRole("button", { name: "Resetuj scenariusz", exact: true }).click();
  await page.getByRole("button", { name: "Anuluj", exact: true }).click();
  await expect(page.getByText("Zaimportowana Anna", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Resetuj scenariusz", exact: true }).click();
  await page.getByRole("button", { name: "Resetuj", exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).activePersonId,
      STORAGE_KEY,
    ),
  ).toBe(null);
});
test("unreadable save stays untouched while the user works in memory", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.setItem(key, '{"version":999}'), STORAGE_KEY);
  await page.reload();
  await expect(page.getByRole("status")).toContainText("nie zostaną nadpisane");
  await choose(page, "Anna Kowalska");
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
    '{"version":999}',
  );
  await page.goto("/#/app/settings");
  await expect(page.getByRole("button", { name: "Pobierz poprzedni zapis" })).toBeVisible();
});
test("storage denial keeps the app usable and offers export", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw new Error("Storage denied");
      },
    });
  });
  await choose(page, "Anna Kowalska");
  await expect(page.getByRole("status")).toContainText("Wyeksportuj");
  await page.goto("/#/app/profil");
  await expect(page.getByLabel("Imię i nazwisko")).toHaveValue("Anna Kowalska");
});
test("map, hash deep links and unknown records work without external requests", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://")) external.push(r.url());
  });
  await page.goto("/#/oferty?view=map");
  await page
    .getByRole("region", { name: "Mapa ofert w Polsce" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("link", { name: "Zobacz rolę", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: "artifacts/job-desktop.png", fullPage: true });
  expect(external).toEqual([]);
  await page.goto("/#/oferty/missing");
  await expect(page.getByRole("heading", { name: "Nie znaleziono strony" })).toBeVisible();
});
test("mobile navigation, light-only appearance and keyboard person selection", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#/auth/sign-in");
  const anna = page.getByRole("button", { name: "Wejdź jako Anna Kowalska", exact: true });
  await anna.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Otwórz menu" }).click();
  await page.getByRole("link", { name: "Profil", exact: true }).click();
  await expect(page.getByLabel("Imię i nazwisko")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/profile-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Otwórz menu" }).click();
  await page.getByRole("link", { name: "Ustawienia", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Motyw" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 244, 240)");
  await page.screenshot({ path: "artifacts/settings-mobile-light.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("core screens have no serious accessibility violations", async ({ page }) => {
  await page.goto("/#/oferty");
  let results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
  await choose(page, "Anna Kowalska");
  await page.goto("/#/app/profil");
  results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("public home and filters reflow at 320px with no external requests", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Praca dla ludzi");
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/#/oferty");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/jobs-mobile.png", fullPage: true });
});

test("application submission explains short answers and missing approval without losing input", async ({
  page,
}) => {
  await choose(page, "Anna Kowalska");
  await page.goto("/#/aplikuj/ai-product-manager");
  const answer = page.getByLabel("Dlaczego pasujesz do tej roli?");
  const send = page.getByRole("button", { name: "Wyślij aplikację", exact: true });
  const own = page.getByLabel("Mój własny wkład (wymagane)");
  await answer.fill("krótka odpowiedź");
  await send.click();
  // Every missing requirement is shown at once; focus goes to the first invalid field.
  await expect(page.getByRole("alert")).toHaveText([
    "Opisz swój własny wkład. To pole jest wymagane przed wysłaniem.",
    /Odpowiedź jest za krótka/,
    "Zatwierdź treść aplikacji i jej przesłanie pracodawcy.",
  ]);
  await expect(own).toBeFocused();
  await expect(own).toHaveAttribute("aria-invalid", "true");
  await expect(answer).toHaveValue("krótka odpowiedź");
  await own.fill(ownWork);
  await page.getByRole("checkbox").check();
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByRole("alert")).toContainText("Odpowiedź jest za krótka");
  await expect(answer).toBeFocused();
  await expect(answer).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(answer).toHaveValue("krótka odpowiedź");
  await answer.fill("Moje doświadczenie pasuje do odpowiedzialności opisanej w tej ofercie.");
  await send.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Zatwierdź treść aplikacji i jej przesłanie pracodawcy.",
  );
  await expect(page.getByRole("checkbox")).toBeFocused();
  await page.getByRole("checkbox").check();
  await send.click();
  await expect(page.getByText("Aplikacja została wysłana.", { exact: false })).toBeVisible();
});

for (const width of [1440, 375]) {
  test(`legacy application draft stays compatible without notes or AI controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const legacy = initialState();
    legacy.activePersonId = "candidate-anna";
    const job = legacy.jobs.find((job) => job.slug === "ai-product-manager")!;
    const draft = {
      candidateId: "candidate-anna",
      jobId: job.id,
      notes: "Dawne notatki źródłowe kandydata",
      generated: "Dawna propozycja AI, która nie jest zatwierdzoną odpowiedzią",
      answer: "Zapisana wcześniej odpowiedź kandydata do dalszej edycji.",
    };
    legacy.drafts.push(draft);
    await choose(page, "Anna Kowalska");
    await page.goto("/#/app/settings");
    await page.getByLabel("Importuj plik scenariusza").setInputFiles({
      name: "legacy-draft.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(legacy)),
    });
    await page.getByRole("button", { name: "Importuj", exact: true }).click();
    await page.goto(`/#/aplikuj/${job.slug}`);
    await page.reload();
    const form = page.locator("main form");
    const answer = page.getByLabel("Dlaczego pasujesz do tej roli?");
    await expect(answer).toHaveValue(draft.answer);
    // The answer plus the four candidate-authored scope card fields; no legacy notes field.
    await expect(form.getByRole("textbox")).toHaveCount(5);
    await expect(page.getByLabel("Twoje notatki do aplikacji (opcjonalnie)")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Przygotuj propozycję z AI" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Użyj propozycji" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Propozycja odpowiedzi" })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(draft.notes);
    await expect(page.locator("main")).not.toContainText(draft.generated);
    const cvSection = form.getByRole("region", { name: "Twoje CV", exact: true });
    await expect(cvSection).toBeVisible();
    await expect(answer).toBeVisible();
    expect(
      await cvSection.evaluate((element) =>
        Boolean(
          element.compareDocumentPosition(document.querySelector("textarea")!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
    ).toBe(true);
    await answer.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("checkbox")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Wyślij aplikację", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Zapisz szkic", exact: true })).toBeFocused();
    const editedAnswer = "Moja poprawiona odpowiedź opisuje doświadczenie potrzebne w tej roli.";
    await fillOwnWork(page);
    await answer.fill(editedAnswer);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("Szkic został zapisany.");
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).drafts.at(-1),
        STORAGE_KEY,
      ),
    ).toEqual({
      ...draft,
      answer: editedAnswer,
      scopeCard: { project: "", ownWork, othersWork: "", result: "" },
    });
    await page.reload();
    await expect(answer).toHaveValue(editedAnswer);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `artifacts/application-simplified-${width}.png`,
      fullPage: true,
    });
    await answer.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Aplikacja została wysłana.", { exact: false })).toBeVisible();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).applications.at(-1),
        STORAGE_KEY,
      ),
    ).toMatchObject({
      sourceNotes: draft.notes,
      generatedAnswer: draft.generated,
      answer: editedAnswer,
    });
    await page.reload();
    await page.getByRole("link", { name: job.title, exact: true }).click();
    await expect(page.locator("main")).toContainText(editedAnswer);
    await expect(page.locator("main")).not.toContainText(draft.notes);
    await expect(page.locator("main")).not.toContainText(draft.generated);
  });
}

test("legacy dark preference keeps scenario data and renders the light interface", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const legacy = { ...initialState(), activePersonId: "candidate-anna", theme: "dark" };
  legacy.people[0].bio = "Zachowaj mój profil";
  await page.goto("/");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw: JSON.stringify(legacy),
  });
  await page.reload();
  await page.goto("/#/app/profil");
  await expect(page.getByRole("textbox", { name: "O mnie", exact: true })).toHaveValue(
    "Zachowaj mój profil",
  );
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 244, 240)");
  await page.getByRole("button", { name: "Zapisz profil", exact: true }).click();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).theme, STORAGE_KEY),
  ).toBeUndefined();
});

test("Poster People offer keeps desktop conditions/actions and places them before mobile reading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await choose(page, "Anna Kowalska");
  await page.goto("/#/oferty/ai-product-manager");
  const article = page.locator(".pp-offer-page");
  const hero = article.locator("header");
  await expect(hero).toContainText(
    "Poprowadź produkt od problemu operacyjnego do mierzalnego wdrożenia AI.",
  );
  await expect(hero.getByText("Senior", { exact: true })).toBeVisible();
  const facts = article.getByRole("complementary");
  await expect(facts.getByRole("heading", { name: "Konkrety", exact: true })).toHaveCount(1);
  await expect(facts).toContainText("Wynagrodzenie");
  const description = article.locator("[data-job-description]");
  const heroBox = await hero.boundingBox();
  const descriptionBox = await description.boundingBox();
  const factsBox = await facts.boundingBox();
  expect(heroBox!.width).toBeLessThanOrEqual(1024);
  expect(factsBox!.x).toBeGreaterThan(descriptionBox!.x + descriptionBox!.width);
  const apply = article.getByRole("link", { name: "Aplikuj", exact: true });
  const applyBox = await apply.boundingBox();
  expect(applyBox!.x).toBeGreaterThan(descriptionBox!.x + descriptionBox!.width);
  await page.screenshot({ path: "artifacts/original-job-layout-desktop.png", fullPage: true });
  const nav = page.getByRole("navigation", { name: "Główna nawigacja" });
  await expect(nav.getByRole("link", { name: "Aplikacje", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Profil", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await facts.boundingBox())!.y).toBeLessThan((await description.boundingBox())!.y);
  await page.screenshot({ path: "artifacts/original-job-layout-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole("link", { name: "Dla firm", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Karolina Wiśniewska", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anna Kowalska", exact: true })).toHaveCount(0);
});

test("restored company and public navigation keep their structure across screen sizes", async ({
  page,
}) => {
  await choose(page, "Anna Kowalska");
  await page.goto("/#/firmy/brightlabs");
  await expect(page.getByRole("heading", { name: "BrightLabs", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Otwarte role", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("51–200 osób");
  await expect(page.getByRole("link", { name: "Strona firmy", exact: false })).toHaveAttribute(
    "href",
    "https://example.com/brightlabs",
  );
  await page.screenshot({ path: "artifacts/original-company-layout-desktop.png", fullPage: true });
  for (const width of [320, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const nav = await page.getByRole("navigation", { name: "Główna nawigacja" }).boundingBox();
    expect(nav!.x + nav!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto("/#/oferty");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dobra robota.");
  await expect(page.getByRole("textbox", { name: "Szukaj ofert", exact: true })).toBeVisible();
  await expect(page.locator("[data-job-page-summary]")).toHaveText("Oferty 1–6 z 6");
  await page.screenshot({ path: "artifacts/original-list-layout-desktop.png", fullPage: true });
});

test("mobile search stays visible and filter dialog restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/oferty");
  const input = page.getByRole("textbox", { name: "Szukaj ofert", exact: true });
  await expect(input).toBeVisible();
  await input.fill("Product");
  await page.getByRole("button", { name: "Szukaj", exact: true }).click();
  await expect(page).toHaveURL(/query=Product/);
  const trigger = page.getByRole("button", { name: "Filtry", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Filtry", exact: true });
  await dialog.getByRole("checkbox", { name: "Zdalnie", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "Zdalnie", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/remote=remote/);
  await trigger.click();
  await dialog.getByRole("button", { name: /Pokaż \d+ ofert/ }).click();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Wyczyść", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page).toHaveURL(/#\/oferty$/);
  await page.goBack();
  await expect(input).toHaveValue("Product");
});

test("desktop reset synchronizes search, category and facets with the URL", async ({ page }) => {
  await page.goto("/#/oferty");
  const input = page.getByRole("textbox", { name: "Szukaj ofert", exact: true });
  await input.fill("Product");
  await page.getByRole("button", { name: "Szukaj", exact: true }).click();
  await page.getByRole("checkbox", { name: "Zdalnie", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Zdalnie", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Wyczyść", exact: true }).first().click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: "Zdalnie", exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: /Wszystkie oferty/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("canonical marketplace typography and search geometry match Poster People breakpoints", async ({
  page,
}) => {
  for (const [width, title, card] of [
    [1280, "72px", "28px"],
    [1100, "58px", "26px"],
    [850, "52px", "28px"],
    [390, "43px", "26px"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/oferty");
    await expect(page.locator(".pp-intro-copy h1")).toHaveCSS("font-size", title);
    await expect(page.locator(".pp-job-title").first()).toHaveCSS("font-size", card);
    await expect(page.getByRole("textbox", { name: "Szukaj ofert", exact: true })).toBeVisible();
    if (width === 1280) {
      expect((await page.locator(".pp-search-form").boundingBox())!.width).toBe(1200);
      await expect(page.locator(".pp-salary-tag").first()).toHaveCSS("font-size", "15px");
    }
  }
  for (const [width, title, salary] of [
    [1280, "64px", "24px"],
    [850, "46px", "20px"],
    [390, "47px", "25px"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/oferty/ai-product-manager");
    await expect(page.locator(".pp-offer-hero h1")).toHaveCSS("font-size", title);
    await expect(page.locator(".pp-offer-pay .pp-salary-tag")).toHaveCSS("font-size", salary);
  }
});

test("offer section links survive copied URLs and restore section focus through history", async ({
  page,
  context,
}) => {
  await page.goto("/#/oferty/ai-product-manager");
  const employer = page.getByRole("link", { name: "O firmie", exact: true });
  const destination = await employer.evaluate((link) => (link as HTMLAnchorElement).href);
  expect(destination).toContain("#/oferty/ai-product-manager#employer");
  await employer.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#employer")).toBeFocused();
  await expect(page).toHaveURL(/#\/oferty\/ai-product-manager#employer$/);
  const copied = await context.newPage();
  await copied.goto(destination);
  await expect(copied.locator(".pp-offer-hero h1")).toHaveText("AI Product Manager");
  await expect(copied.locator("#employer")).toBeFocused();
  expect((await copied.locator("#employer").boundingBox())!.y).toBeLessThan(50);
  await copied.close();
  await page.getByRole("link", { name: "O roli", exact: true }).click();
  await expect(page.locator("#role")).toBeFocused();
  await page.goBack();
  await expect(page.locator("#employer")).toBeFocused();
  await page.goForward();
  await expect(page.locator("#role")).toBeFocused();
});

for (const width of [1280, 390])
  test(`keyboard chip removal keeps a logical focus successor at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/oferty?query=Product&remote=remote");
    const remote = page.getByRole("button", { name: "Usuń filtr: remote", exact: true });
    await remote.focus();
    await page.keyboard.press("Enter");
    const query = page.getByRole("button", { name: "Usuń filtr: Product", exact: true });
    await expect(query).toBeFocused();
    await expect(page).not.toHaveURL(/remote=/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Oferty pracy", exact: true })).toBeFocused();
    await expect(page.getByRole("textbox", { name: "Szukaj ofert", exact: true })).toHaveValue("");
  });

test("homepage surfaces and marketplace action type roles match the shared reference", async ({
  page,
}) => {
  await page.goto("/#/");
  const cards = page.locator("main article.prototype-panel");
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card).toHaveCSS("border-radius", "24px");
    await expect(card).toHaveCSS("box-shadow", /rgb\(24, 24, 24\).*1px inset/);
  }
  for (const [width, searchSize, offerSize, payLine] of [
    [1280, "14px", "14px", "34.8px"],
    [1100, "14px", "13px", "31.9px"],
    [850, "12px", "12px", "29px"],
    [700, "12px", "14px", "36.25px"],
    [600, "12px", "14px", "33.75px"],
    [390, "12px", "14px", "33.75px"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/oferty");
    const search = page.getByRole("button", { name: "Szukaj", exact: true });
    await expect(search).toHaveCSS("font-size", searchSize);
    await expect(search).toHaveCSS("font-weight", "600");
    await expect(search).toHaveCSS("letter-spacing", "normal");
    await expect(search).toHaveCSS("line-height", `${parseInt(searchSize) * 1.5}px`);
    await expect(search).toHaveCSS("border-top-width", "1px");
    await expect(search).toHaveCSS("box-shadow", "none");
    await page.goto("/#/oferty/ai-product-manager");
    const action = page.locator(".pp-offer-actions a").first();
    await expect(action).toHaveCSS("font-size", offerSize);
    await expect(action).toHaveCSS("font-weight", "600");
    await expect(action).toHaveCSS("line-height", `${parseInt(offerSize) * 1.5}px`);
    await expect(page.locator(".pp-offer-pay .pp-salary-tag")).toHaveCSS("line-height", payLine);
  }
});

test("process sheet keeps notes across keyboard tabs and saves stage history with focus", async ({
  page,
}) => {
  await choose(page, "Karolina Wiśniewska");
  await page.goto("/#/app/kandydaci/application-example");
  const note = page.getByLabel("Notatka rekrutacyjna (widoczna pracodawcy)");
  await expect(
    page.locator(".record-meta").getByText("Match Score: 72%", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Wynik przykładowy", { exact: true })).toHaveCount(0);
  await expect(page.locator("iframe[title='Podgląd CV (PDF)']")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveCount(0);
  const text = "Dopytać o decyzje dotyczące automatyzacji obsługi.";
  await note.fill(text);
  const answer = page.getByRole("tab", { name: "Odpowiedź", exact: true });
  const cv = page.getByRole("tab", { name: "CV", exact: true });
  await answer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(cv).toBeFocused();
  await expect(cv).toHaveAttribute("aria-selected", "true");
  const preview = page.locator("iframe[title='Podgląd CV (PDF)']");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("src", /^\.?\/cv\/marek-nowak-cv-v1\.pdf#view=FitH$/);
  await page.setViewportSize({ width: 390, height: 900 });
  expect(
    await preview.evaluate((element) => element.getBoundingClientRect().right <= innerWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect(note).toHaveValue(text);
  await expect(page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveAttribute(
    "href",
    /^\.?\/cv\/marek-nowak-cv-v1\.pdf$/,
  );
  await page.keyboard.press("Home");
  await expect(answer).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Odpowiedź", exact: true })).toContainText(
    "Przesłana aplikacja",
  );
  await expect(note).toHaveValue(text);
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "W przeglądzie", exact: true }).click();
  await expect(page.locator(".record-stage")).toBeFocused();
  await expect(note).toHaveValue("");
  await expect(page.locator(".process-timeline")).toContainText(text);
  await page.reload();
  await expect(page.locator(".process-timeline")).toContainText(text);
  await note.fill("Zakończenie przykładowego procesu.");
  await page.getByRole("button", { name: "Proces zakończony", exact: true }).click();
  await expect(page.locator(".record-stage")).toBeFocused();
  await expect(note).toHaveCount(0);
  await expect(page.locator(".record-actions")).toHaveCount(0);
  await expect(page.locator(".process-timeline li")).toHaveCount(3);
  const accessibility = await new AxeBuilder({ page }).include(".recruiting-record").analyze();
  expect(accessibility.violations).toEqual([]);
  await choose(page, "Marek Nowak");
  await page.goto("/#/app/aplikacje/application-example");
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
});

test("process sheet renders custom snapshots and long content on narrow screens", async ({
  page,
}) => {
  const state = initialState();
  state.activePersonId = "employer-brightlabs";
  const record = state.applications[0];
  record.candidateName = "Marek Nowak z bardzo długim przykładowym nazwiskiem";
  record.jobTitle =
    "Lider rozwoju produktów i automatyzacji procesów z wykorzystaniem sztucznej inteligencji";
  record.cv = "Zapisane niestandardowe CV z importu.\n" + "DoświadczenieBezSpacji".repeat(50);
  record.answer =
    "Długa polska odpowiedź z wieloma przykładami. ".repeat(60) + "DługiWyraz".repeat(60);
  await page.goto("/");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw: JSON.stringify(state),
  });
  await page.reload();
  await choose(page, "Karolina Wiśniewska");
  await page.goto("/#/app/kandydaci/application-example");
  await expect(page.getByText("Zapisana treść CV", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "CV", exact: true }).click();
  await expect(page.getByText("Zapisana treść CV", { exact: true })).toBeVisible();
  await expect(page.locator("iframe[title='Podgląd CV (PDF)']")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tabpanel", { name: "CV", exact: true })).toContainText(record.cv);
  for (const width of [1280, 951, 950, 768, 767, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => {
        const elements = [...document.querySelectorAll(".recruiting-record, .recruiting-record *")];
        return (
          document.documentElement.scrollWidth <= innerWidth &&
          elements.every((element) => {
            const rect = element.getBoundingClientRect();
            return !rect.width || (rect.left >= -1 && rect.right <= innerWidth + 1);
          })
        );
      }),
    ).toBe(true);
  }
  await page.getByRole("tab", { name: "Odpowiedź", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Odpowiedź", exact: true })).toContainText(
    record.answer,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [1280, 390]) {
  test(`application keeps editable draft while reading offer context at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await choose(page, "Anna Kowalska");
    await page.goto("/#/oferty/ai-product-manager");
    const gap = await page.locator(".pp-offer-actions").evaluate((element) => {
      const [apply, save] = element.querySelectorAll("a, button");
      return save.getBoundingClientRect().top - apply.getBoundingClientRect().bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(10);
    await page.getByRole("link", { name: "Aplikuj", exact: true }).click();
    const offer = page.getByRole("complementary", { name: "AI Product Manager", exact: true });
    await expect(offer).toContainText("BrightLabs");
    await expect(offer).toContainText("Hybrydowo");
    const form = page.getByRole("form", { name: "Twoja aplikacja", exact: true });
    const answer = form.getByLabel("Dlaczego pasujesz do tej roli?");
    const text = "Prowadziłam badania i wdrożenie automatyzacji obsługi zgłoszeń w produkcie B2B.";
    await answer.fill(text);
    await form.getByRole("checkbox").check();
    const description = offer.locator("summary");
    await description.focus();
    await page.keyboard.press("Enter");
    await expect(offer.locator("[data-job-description]")).toBeVisible();
    await expect(answer).toHaveValue(text);
    await expect(form.getByRole("checkbox")).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(offer.locator("[data-job-description]")).toBeHidden();
    await expect(form.getByRole("region", { name: "Twoje CV", exact: true })).toContainText(
      "CV z Twojego profilu",
    );
    await expect(form.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveAttribute(
      "href",
      /^\.?\/cv\/anna-kowalska-cv-v1\.pdf$/,
    );
    await form.getByRole("button", { name: "Zapisz szkic", exact: true }).click();
    await page.reload();
    await expect(answer).toHaveValue(text);
    await expect(form.getByRole("checkbox")).not.toBeChecked();
    const accessibility = await new AxeBuilder({ page }).include(".application-page").analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`submission celebrates only once after success with motion ${reducedMotion}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await choose(page, "Anna Kowalska");
    await page.goto("/#/aplikuj/ai-product-manager");
    const answer = page.getByLabel("Dlaczego pasujesz do tej roli?");
    await fillOwnWork(page);
    await answer.fill("krótko");
    await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Odpowiedź jest za krótka" }),
    ).toContainText("Odpowiedź jest za krótka");
    await expect(page.locator(".confetti-burst")).toHaveCount(0);
    await answer.fill(
      "Prowadziłam badania użytkowników i wdrożenie automatyzacji procesu obsługi.",
    );
    await page.getByRole("button", { name: "Zapisz szkic", exact: true }).click();
    await expect(page.locator(".confetti-burst")).toHaveCount(0);
    await page.getByRole("checkbox").check();
    await page.clock.install({ time: new Date("2026-11-03T10:00:00Z") });
    await page.clock.pauseAt(new Date("2026-11-03T10:00:01Z"));
    await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
    await expect(page.getByRole("button", { name: "Wysłano!", exact: true })).toBeDisabled();
    await expect(answer).toBeDisabled();
    if (reducedMotion === "no-preference") {
      await expect(page.locator(".confetti-burst")).toHaveAttribute("aria-hidden", "true");
      expect(
        await page
          .locator(".confetti-burst")
          .evaluate((element) => getComputedStyle(element).pointerEvents),
      ).toBe("none");
      await expect(page.locator(".confetti-burst span")).toHaveCount(30);
    } else {
      await expect(page.locator(".confetti-burst")).toHaveCount(0);
    }
    await page.locator("form").dispatchEvent("submit");
    expect(
      await page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).applications.filter(
            (item: { candidateId: string }) => item.candidateId === "candidate-anna",
          ).length,
        STORAGE_KEY,
      ),
    ).toBe(1);
    await page.clock.fastForward(reducedMotion === "reduce" ? 1 : 1000);
    await expect(page).toHaveURL(/#\/app\/aplikacje\?wyslano=1$/);
    await expect(page.locator(".confetti-burst")).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".confetti-burst")).toHaveCount(0);
    await page.goto("/#/aplikuj/ai-product-manager");
    await expect(
      page.getByText("Aplikacja na tę ofertę została już wysłana.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".confetti-burst")).toHaveCount(0);
  });
}

test("candidate record shares snapshot tabs while excluding employer notes and managing withdrawal focus", async ({
  page,
}) => {
  const state = initialState();
  state.activePersonId = "candidate-marek";
  const record = state.applications[0];
  record.stage = "reviewed";
  record.events.push({
    stage: "reviewed",
    at: "2026-11-02T10:00:00.000Z",
    note: "Notatka wyłącznie dla pracodawcy.",
  });
  record.sourceNotes = "Dawna prywatna notatka źródłowa.";
  record.generatedAnswer = "Dawna propozycja, która nie jest zatwierdzoną odpowiedzią.";
  await page.goto("/");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw: JSON.stringify(state),
  });
  await page.goto("/#/app/aplikacje/application-example");
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: record.jobTitle, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".record-meta")).toContainText("Match Score: 72%");
  await expect(page.locator("main")).not.toContainText(record.events[1].note);
  await expect(page.locator("main")).not.toContainText(record.sourceNotes);
  await expect(page.locator("main")).not.toContainText(record.generatedAnswer);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Odpowiedź", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "CV", exact: true })).toBeFocused();
  await expect(page.locator("iframe[title='Podgląd CV (PDF)']")).toHaveAttribute(
    "src",
    /^\.?\/cv\/marek-nowak-cv-v1\.pdf#view=FitH$/,
  );
  await expect(page.locator("main")).not.toContainText(record.events[1].note);
  await page.keyboard.press("Home");
  await expect(page.getByRole("tabpanel", { name: "Odpowiedź", exact: true })).toContainText(
    record.answer,
  );
  const trigger = page.getByRole("button", { name: "Wycofaj aplikację", exact: true });
  const confirm = page.getByRole("button", { name: "Potwierdź wycofanie", exact: true });
  await trigger.click();
  await expect(confirm).toBeFocused();
  await page.getByRole("button", { name: "Anuluj", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await confirm.click();
  await expect(page.locator(".record-stage")).toHaveText("Wycofana");
  await expect(page.locator(".record-stage")).toBeFocused();
  await expect(trigger).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Aplikacja została wycofana.");
  const accessibility = await new AxeBuilder({ page }).include(".recruiting-record").analyze();
  expect(accessibility.violations).toEqual([]);
  await page.reload();
  await expect(page.locator(".record-stage")).toHaveText("Wycofana");
  await expect(trigger).toHaveCount(0);
  await choose(page, "Anna Kowalska");
  await page.goto("/#/app/aplikacje/application-example");
  await expect(
    page.getByRole("heading", { name: "Nie znaleziono strony", exact: true }),
  ).toBeVisible();
});

test("candidate snapshot supports custom CV and long content at desktop and mobile widths", async ({
  page,
}) => {
  const state = initialState();
  state.activePersonId = "candidate-marek";
  const record = state.applications[0];
  record.jobTitle =
    "Starszy lider rozwoju produktów i automatyzacji z wykorzystaniem sztucznej inteligencji";
  record.cv = "Niestandardowa zapisana treść CV.\n" + "DoświadczenieBezSpacji".repeat(70);
  record.answer = "Opis realizowanych projektów i podejmowanych decyzji. ".repeat(40);
  await page.goto("/");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw: JSON.stringify(state),
  });
  await page.goto("/#/app/aplikacje/application-example");
  await page.reload();
  await page.getByRole("tab", { name: "CV", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "CV", exact: true })).toContainText(record.cv);
  await expect(page.locator("iframe[title='Podgląd CV (PDF)']")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pobierz CV (PDF)", exact: true })).toHaveCount(0);
  for (const width of [1280, 1100, 951, 950, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole("tab", { name: "Odpowiedź", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Odpowiedź", exact: true })).toContainText(
    record.answer,
  );
});

test("scope card is saved in the profile, reused in an application and shown first to the employer", async ({
  page,
}) => {
  await choose(page, "Anna Kowalska");
  await page.goto("/#/app/profil");
  const profileCard = page.getByRole("form", { name: "Mój zakres", exact: true });
  await profileCard.getByLabel("Projekt i kontekst (opcjonalnie)").fill("Asystent do zgłoszeń");
  await profileCard.getByLabel("Mój własny wkład (opcjonalnie)").fill(ownWork);
  await profileCard.getByRole("button", { name: "Zapisz kartę", exact: true }).click();
  await expect(profileCard.getByRole("status")).toHaveText(
    "Karta „Mój zakres” została zapisana w profilu.",
  );
  await page.reload();
  await expect(profileCard.getByLabel("Mój własny wkład (opcjonalnie)")).toHaveValue(ownWork);
  await page.goto("/#/app/profil/podglad");
  await expect(page.locator("main")).toContainText(ownWork);

  await page.goto("/#/aplikuj/ai-product-manager");
  const own = page.getByLabel("Mój własny wkład (wymagane)");
  await expect(own).toHaveValue(ownWork);
  await expect(
    page.getByText("Karta została wypełniona z Twojego profilu.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Dlaczego pasujesz do tej roli?")
    .fill("Prowadziłam rozwój narzędzi dla zespołów operacyjnych i badania z użytkownikami.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
  await expect(page.getByText("Aplikacja została wysłana.", { exact: false })).toBeVisible();

  await page.goto("/#/app/profil");
  await profileCard.getByLabel("Mój własny wkład (opcjonalnie)").fill("Zmieniony opis w profilu.");
  await profileCard.getByRole("button", { name: "Zapisz kartę", exact: true }).click();

  await choose(page, "Karolina Wiśniewska");
  await page.getByRole("link", { name: "Kandydaci", exact: true }).click();
  await expect(page.locator("main")).toContainText(`Mój własny wkład: ${ownWork}`);
  await expect(page.locator("main")).toContainText("Mój własny wkład: Przeprowadziłem 12 wywiadów");
  await page.getByRole("link", { name: "Anna Kowalska", exact: true }).click();
  const sheet = page.getByRole("region", { name: "Materiały kandydata", exact: true });
  const card = sheet.getByRole("region", { name: "Mój zakres", exact: true });
  await expect(card).toContainText(ownWork);
  await expect(card).not.toContainText("Zmieniony opis w profilu.");
  await expect(card.locator("dt")).toHaveText([
    "Projekt i kontekst",
    "Mój własny wkład",
    "Wkład innych osób",
    "Rezultat i czego nie mogę pokazać",
  ]);
  await expect(card.locator("dd").nth(2)).toHaveText("brak informacji w zgłoszeniu");
  expect(
    await card.evaluate((element) =>
      Boolean(
        element.compareDocumentPosition(document.querySelector('[role="tablist"]')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include(".recruiting-record").analyze();
  expect(accessibility.violations).toEqual([]);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.screenshot({ path: "artifacts/scope-card-employer-320.png", fullPage: true });
});
