import { expect, test } from "@playwright/test"

// En mode mock, la session démarre authentifiée. Pour tester la page de login,
// il faut d'abord se déconnecter via le compte.

test.describe("Authentification", () => {
  test("connexion réussie avec identifiants valides → dashboard visible", async ({ page }) => {
    // En mode mock, l'app démarre directement connectée et redirige vers /
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "homeserver01" })).toBeVisible()
  })

  test("déconnexion depuis le compte → retour à la page login", async ({ page }) => {
    await page.goto("/account")
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible()
    await page.getByRole("button", { name: "Se déconnecter" }).click()
    await expect(page).toHaveURL("/login")
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible()
  })

  test("connexion depuis la page login après déconnexion → dashboard visible", async ({ page }) => {
    // Se déconnecter d'abord
    await page.goto("/account")
    await page.getByRole("button", { name: "Se déconnecter" }).click()
    await expect(page).toHaveURL("/login")

    // En mode mock, signIn accepte n'importe quels identifiants
    await page.getByLabel("Email").fill("admin@homelab.local")
    await page.getByLabel("Mot de passe").fill("password")
    await page.getByRole("button", { name: "Se connecter" }).click()

    await expect(page.getByRole("heading", { name: "homeserver01" })).toBeVisible()
  })

  test("tentative de connexion avec formulaire vide → bouton submit désactivé ou validation HTML", async ({ page }) => {
    // Se déconnecter pour accéder à /login
    await page.goto("/account")
    await page.getByRole("button", { name: "Se déconnecter" }).click()
    await expect(page).toHaveURL("/login")

    // Les champs ont required — le submit ne déclenche pas la requête si vides
    const submitButton = page.getByRole("button", { name: "Se connecter" })
    await expect(submitButton).toBeVisible()
    await expect(submitButton).not.toBeDisabled()

    // Vérifier que la page reste sur /login sans identifiants
    await submitButton.click()
    await expect(page).toHaveURL("/login")
  })
})
