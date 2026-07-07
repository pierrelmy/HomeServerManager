import { expect, test } from "@playwright/test"

// Le mock terminal démarre avec une session "local-shell" et deux lignes d'historique
// (commandes "uptime" et "docker ps"). La page expose un bouton "Réinitialiser" et
// un formulaire de saisie. Il n'y a pas de bouton "Synchroniser" ni de raccourcis rapides.

test.describe("Terminal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/terminal")
    await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible()
  })

  test("affiche une session active", async ({ page }) => {
    // Le badge "Session active" doit être visible (exact pour éviter le match avec le sous-titre)
    await expect(page.getByText("Session active", { exact: true })).toBeVisible()
  })

  test("affiche les lignes d'historique du mock", async ({ page }) => {
    // Le mock pré-charge deux commandes : "uptime" et "docker ps ..."
    await expect(page.getByText("uptime")).toBeVisible()
    await expect(page.getByText(/docker ps/)).toBeVisible()
  })

  test("affiche le prompt de la session active", async ({ page }) => {
    // Le prompt mock est "pierre@homeserver01:~$", apparaît une fois par ligne d'historique
    await expect(page.getByText(/pierre@homeserver01/).first()).toBeVisible()
  })

  test("saisir une commande et l'envoyer via Entrée → une ligne de résultat apparaît", async ({ page }) => {
    const input = page.locator("form input")
    await input.fill("df -h")
    await input.press("Enter")

    // Le mock simule df -h avec une sortie connue
    await expect(page.getByText(/Filesystem/)).toBeVisible()
  })

  test("saisir une commande et cliquer Exécuter → une ligne de résultat apparaît", async ({ page }) => {
    const input = page.locator("form input")
    await input.fill("uptime")
    await page.getByRole("button", { name: "Exécuter" }).click()

    // La commande "uptime" ne fait pas partie des commandes simulées spéciales,
    // donc le mock retourne la réponse générique "Commande simulée: uptime"
    await expect(page.getByText(/Commande simulée: uptime/)).toBeVisible()
  })

  test("l'input se vide après l'envoi d'une commande", async ({ page }) => {
    const input = page.locator("form input")
    await input.fill("ls -la")
    await page.getByRole("button", { name: "Exécuter" }).click()
    await expect(input).toHaveValue("")
  })

  test("commande inconnue → réponse simulée générique affichée", async ({ page }) => {
    const input = page.locator("form input")
    await input.fill("ls -la")
    await input.press("Enter")

    await expect(page.getByText(/Commande simulée: ls -la/)).toBeVisible()
  })

  test("le bouton Réinitialiser est disponible et cliquable", async ({ page }) => {
    await page.getByRole("button", { name: "Réinitialiser" }).click()
    // Après réinitialisation, le heading Terminal reste visible
    await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible()
    await expect(page.getByText("Session active", { exact: true })).toBeVisible()
  })
})
