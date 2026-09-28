import { expect, test, type Page } from "@playwright/test";

async function authenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return () => client.send("WebAuthn.clearCredentials", { authenticatorId });
}

test("owner passkey, credential management, logout and subsequent login", async ({
  page,
}) => {
  await authenticator(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.getByLabel("Your name").fill("Instance owner");
  await page.getByLabel("Setup token").fill(process.env.E2E_SETUP_TOKEN!);
  await page
    .getByRole("button", { name: "Create owner and register passkey" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Credentials", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Credential name").fill("Production test");
  await page
    .getByLabel("Test token", { exact: true })
    .fill("test-valid-first-secret");
  await page.getByRole("button", { name: "Verify and save" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Credential verified and saved.",
  );
  await expect(page.getByLabel("Test token", { exact: true })).toHaveValue("");
  expect(await page.content()).not.toContain("test-valid-first-secret");
  expect(
    await (await page.request.get("/api/credentials")).text(),
  ).not.toContain("test-valid-first-secret");
  await page.getByLabel("Credential name").fill("Staging test");
  await page
    .getByLabel("Test token", { exact: true })
    .fill("invalid-test-secret");
  await page.getByRole("button", { name: "Save unverified" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Credential saved without verification.",
  );
  const first = page.getByRole("region", {
    name: "Production test",
    exact: true,
  });
  const second = page.getByRole("region", {
    name: "Staging test",
    exact: true,
  });
  await second.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(second).toContainText("Verification failed");
  await first.getByRole("button", { name: "Set default" }).click();
  await expect(first).toContainText("Default");
  await second.getByRole("button", { name: "Set default" }).click();
  await expect(second).toContainText("Default");
  await first.getByRole("button", { name: "Replace secret" }).click();
  await first
    .getByLabel("Test token", { exact: true })
    .fill("test-valid-replacement");
  await first.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(first).toContainText("Unverified");
  await first.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(first).toContainText("Valid");
  await second.getByRole("button", { name: "Delete", exact: true }).click();
  await second.getByRole("button", { name: "Confirm delete" }).click();
  await expect(second).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/settings/credentials");
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/credentials")).status()).toBe(401);
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("real WebAuthn verification, replay and origin/RP rejection in workerd with D1", async ({
  page,
}) => {
  const clearCredentials = await authenticator(page);
  await page.goto("/login");
  const endpoint = "http://127.0.0.1:3101";
  const post = (path: string, data: unknown, replayCookie?: string) =>
    page.request.post(`${endpoint}/api/auth/${path}`, {
      data,
      headers: {
        Origin: "http://localhost:3100",
        ...(replayCookie ? { Cookie: replayCookie } : {}),
      },
    });
  const begin = () =>
    post("register/options", {
      name: "Worker owner",
      setupToken: process.env.E2E_SETUP_TOKEN,
    });
  async function registerResponse(options: Record<string, unknown>) {
    return page.evaluate(async (options) => {
      const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(
        options as unknown as PublicKeyCredentialCreationOptionsJSON,
      );
      return (
        (await navigator.credentials.create({
          publicKey,
        })) as PublicKeyCredential
      ).toJSON();
    }, options);
  }
  const wrongOrigin = await registerResponse(await (await begin()).json());
  const changed = JSON.parse(
    Buffer.from(
      (wrongOrigin as { response: { clientDataJSON: string } }).response
        .clientDataJSON,
      "base64url",
    ).toString(),
  );
  changed.origin = "https://evil.test";
  (
    wrongOrigin as { response: { clientDataJSON: string } }
  ).response.clientDataJSON = Buffer.from(JSON.stringify(changed)).toString(
    "base64url",
  );
  expect((await post("register/verify", wrongOrigin)).status()).toBe(401);
  await clearCredentials();
  const staleRegistration = await registerResponse(
    await (await begin()).json(),
  );
  await begin();
  expect((await post("register/verify", staleRegistration)).status()).toBe(401);
  await clearCredentials();
  const registration = await registerResponse(await (await begin()).json());
  const registrationCookie = (await page.context().cookies(endpoint))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  expect((await post("register/verify", registration)).status()).toBe(200);
  expect(
    (await post("register/verify", registration, registrationCookie)).status(),
  ).toBe(401);
  expect((await begin()).status()).toBe(409);
  expect((await post("logout", {})).status()).toBe(200);
  async function assertion() {
    const options = await (await post("login/options", {})).json();
    return page.evaluate(async (options) => {
      const publicKey =
        PublicKeyCredential.parseRequestOptionsFromJSON(options);
      return (
        (await navigator.credentials.get({ publicKey })) as PublicKeyCredential
      ).toJSON();
    }, options);
  }
  const badRP = await assertion();
  const authData = Buffer.from(
    (badRP as { response: { authenticatorData: string } }).response
      .authenticatorData,
    "base64url",
  );
  authData[0] ^= 1;
  (
    badRP as { response: { authenticatorData: string } }
  ).response.authenticatorData = authData.toString("base64url");
  expect((await post("login/verify", badRP)).status()).toBe(401);
  const login = await assertion();
  const loginCookie = (await page.context().cookies(endpoint))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  expect((await post("login/verify", login)).status()).toBe(200);
  expect((await post("login/verify", login, loginCookie)).status()).toBe(401);
  const response = await page.request.post(`${endpoint}/api/credentials`, {
    headers: { Origin: "http://localhost:3100" },
    data: {
      provider: "test-token",
      name: "Worker credential",
      secret: { token: "test-valid-worker-secret" },
      verify: true,
    },
  });
  expect(response.status()).toBe(201);
  const list = await page.request.get(`${endpoint}/api/credentials`);
  expect(list.status()).toBe(200);
  expect(await list.text()).not.toContain("test-valid-worker-secret");
  expect((await post("logout", {})).status()).toBe(200);
  expect((await page.request.get(`${endpoint}/api/credentials`)).status()).toBe(
    401,
  );
});
