import { expect, test } from "@playwright/test"

// En mode mock, la session démarre authentifiée. La sidebar utilise des labels
// en anglais (Overview, NAS, Services, Docker, Terminal, Tools, Account, Settings).

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "homeserver01" })).toBeVisible()
  })

  test("page Services affiche un heading Services", async ({ page }) => {
    await page.getByRole("link", { name: "Services" }).click()
    await expect(page).toHaveURL("/services")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Services")
  })

  test("page Docker affiche un heading Docker", async ({ page }) => {
    await page.getByRole("link", { name: "Docker" }).click()
    await expect(page).toHaveURL("/docker")
    await expect(page.getByRole("heading", { name: "Docker" })).toBeVisible()
  })

  test("page NAS affiche un heading NAS", async ({ page }) => {
    await page.getByRole("link", { name: "NAS" }).click()
    await expect(page).toHaveURL("/nas")
    await expect(page.getByRole("heading", { name: "NAS" })).toBeVisible()
  })

  test("page Tools affiche un heading Tools", async ({ page }) => {
    await page.getByRole("link", { name: "Tools" }).click()
    await expect(page).toHaveURL("/tools")
    await expect(page.getByRole("heading", { name: "Tools" })).toBeVisible()
  })

  test("page Terminal affiche un heading Terminal", async ({ page }) => {
    await page.getByRole("link", { name: "Terminal" }).click()
    await expect(page).toHaveURL("/terminal")
    await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible()
  })

  test("page Settings affiche un heading Settings", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click()
    await expect(page).toHaveURL("/settings")
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
  })

  test("page Account affiche un heading Account", async ({ page }) => {
    await page.getByRole("link", { name: "Account" }).click()
    await expect(page).toHaveURL("/account")
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible()
  })

  test("retour vers le dashboard depuis une page interne", async ({ page }) => {
    await page.getByRole("link", { name: "Services" }).click()
    await expect(page).toHaveURL("/services")

    await page.getByRole("link", { name: "Overview" }).click()
    await expect(page).toHaveURL("/")
    await expect(page.getByRole("heading", { name: "homeserver01" })).toBeVisible()
  })
})
