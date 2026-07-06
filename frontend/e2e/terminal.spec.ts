import { expect, test } from "@playwright/test"

// Le mock terminal démarre avec une session "local-shell" et deux lignes d'historique
// (commandes "uptime" et "docker ps"). Le bouton "Synchroniser" recharge l'état
// depuis le mock. Il n'y a pas de bouton "Réinitialiser" — on teste donc la saisie
// et l'exécution de commandes.

test.describe("Terminal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/terminal")
    await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible()
  })

  test("affiche une session active", async ({ page }) => {
    // Le badge "Session active" doit être visible
    await expect(page.getByText("Session active")).toBeVisible()
  })

  test("affiche les lignes d'historique du mock", async ({ page }) => {
    // Le mock pré-charge deux commandes : "uptime" et "docker ps ..."
    await expect(page.getByText("uptime")).toBeVisible()
    await expect(page.getByText(/docker ps/)).toBeVisible()
  })

  test("affiche le prompt de la session active", async ({ page }) => {
    // Le prompt mock est "pierre@homeserver01:~$"
    await expect(page.getByText(/pierre@homeserver01/)).toBeVisible()
  })

  test("saisir une commande et l'envoyer via Entrée → une ligne de résultat apparaît", async ({ page }) => {
    const input = page.getByPlaceholder(/Tape une commande/)
    await input.fill("df -h")
    await input.press("Enter")

    // Le mock simule df -h avec une sortie connue
    await expect(page.getByText(/Filesystem/)).toBeVisible()
  })

  test("saisir une commande et cliquer Exécuter → une ligne de résultat apparaît", async ({ page }) => {
    const input = page.getByPlaceholder(/Tape une commande/)
    await input.fill("uptime")
    await page.getByRole("button", { name: "Exécuter" }).click()

    // La commande "uptime" ne fait pas partie des commandes simulées spéciales,
    // donc le mock retourne la réponse générique "Commande simulée: uptime"
    await expect(page.getByText(/Commande simulée: uptime/)).toBeVisible()
  })

  test("utiliser un raccourci depuis le panneau rapide → remplit l'input", async ({ page }) => {
    // Le mock définit quickCommands: ["uptime", "docker ps", "df -h", "journalctl -p err -n 5"]
    await page.getByRole("button", { name: "docker ps" }).click()

    const input = page.getByPlaceholder(/Tape une commande/)
    await expect(input).toHaveValue("docker ps")
  })

  test("commande inconnue → réponse simulée générique affichée", async ({ page }) => {
    const input = page.getByPlaceholder(/Tape une commande/)
    await input.fill("ls -la")
    await input.press("Enter")

    await expect(page.getByText(/Commande simulée: ls -la/)).toBeVisible()
  })

  test("le bouton Synchroniser recharge l'état du terminal", async ({ page }) => {
    await page.getByRole("button", { name: "Synchroniser" }).click()
    // Après synchronisation, le heading Terminal reste visible
    await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible()
    await expect(page.getByText("Session active")).toBeVisible()
  })
})
