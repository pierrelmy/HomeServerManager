import { expect, test } from "@playwright/test"

test("loads the dashboard and starts a service", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "homeserver01" })).toBeVisible()

  await page.getByRole("link", { name: "Services" }).click()
  await expect(page.getByRole("heading", { name: /Services/ })).toBeVisible()
  await page.getByPlaceholder("Rechercher un service").fill("Jenkins")
  await page.getByRole("button", { name: "Démarrer" }).click()
  await expect(page.locator(".service-card").getByText("Running")).toBeVisible()
})
