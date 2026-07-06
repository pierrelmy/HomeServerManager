import { expect, test } from "@playwright/test"

// Le mock définit 3 services :
//   - Ollama (status: failed)  → actions: Démarrer, Redémarrer, Voir les logs
//   - Jenkins (status: stopped) → actions: Démarrer, Voir les logs
//   - Docker Engine (status: running) → actions: Arrêter, Redémarrer, Voir les logs

test.describe("Services", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/services")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Services")
  })

  test("affiche la liste des services du mock", async ({ page }) => {
    await expect(page.getByText("Ollama")).toBeVisible()
    await expect(page.getByText("Jenkins")).toBeVisible()
    await expect(page.getByText("Docker Engine")).toBeVisible()
  })

  test("affiche le nombre de services dans le heading", async ({ page }) => {
    // Le heading est "Services • 3"
    await expect(page.getByRole("heading", { level: 1 })).toContainText("3")
  })

  test("recherche filtre la liste par nom de service", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Rechercher un service")
    await searchInput.fill("Jenkins")

    await expect(page.getByText("Jenkins")).toBeVisible()
    await expect(page.getByText("Ollama")).not.toBeVisible()
    await expect(page.getByText("Docker Engine")).not.toBeVisible()
  })

  test("recherche vide affiche à nouveau tous les services", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Rechercher un service")
    await searchInput.fill("Jenkins")
    await expect(page.getByText("Ollama")).not.toBeVisible()

    await searchInput.clear()
    await expect(page.getByText("Ollama")).toBeVisible()
    await expect(page.getByText("Jenkins")).toBeVisible()
    await expect(page.getByText("Docker Engine")).toBeVisible()
  })

  test("recherche sans résultat affiche un message d'avertissement", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Rechercher un service")
    await searchInput.fill("service-inexistant-xyz")

    await expect(page.getByText("Aucun service ne correspond à cette recherche")).toBeVisible()
  })

  test("bouton Démarrer visible sur un service arrêté (Jenkins)", async ({ page }) => {
    // Jenkins est "stopped" → bouton Démarrer disponible
    const jenkinsCard = page.locator(".border.rounded.p-3", { hasText: "Jenkins" })
    await expect(jenkinsCard.getByRole("button", { name: "Démarrer" })).toBeVisible()
  })

  test("bouton Arrêter visible sur un service en cours (Docker Engine)", async ({ page }) => {
    // Docker Engine est "running" → bouton Arrêter disponible
    const dockerCard = page.locator(".border.rounded.p-3", { hasText: "Docker Engine" })
    await expect(dockerCard.getByRole("button", { name: "Arrêter" })).toBeVisible()
  })

  test("bouton Redémarrer visible sur un service en cours (Docker Engine)", async ({ page }) => {
    const dockerCard = page.locator(".border.rounded.p-3", { hasText: "Docker Engine" })
    await expect(dockerCard.getByRole("button", { name: "Redémarrer" })).toBeVisible()
  })

  test("démarrer Jenkins → status passe à Running", async ({ page }) => {
    await page.getByPlaceholder("Rechercher un service").fill("Jenkins")
    await page.getByRole("button", { name: "Démarrer" }).click()

    // Après l'action start, le mock met le status à "running"
    await expect(page.locator(".fw-medium", { hasText: "Running" })).toBeVisible()
  })

  test("bouton Voir les logs ouvre un panneau latéral", async ({ page }) => {
    // Ollama a des logs dans le mock
    const ollamaCard = page.locator(".border.rounded.p-3", { hasText: "Ollama" })
    await ollamaCard.getByRole("button", { name: "Voir les logs" }).click()

    // Le panneau offcanvas s'ouvre avec le titre du service
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("Starting the service...")).toBeVisible()
  })
})
