import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import manifest from "../src/app/manifest.js";

test("manifesto define os dados necessários para instalação do PWA", () => {
  const data = manifest();

  assert.equal(data.name, "LegadoCar");
  assert.equal(data.start_url, "/");
  assert.equal(data.scope, "/");
  assert.equal(data.display, "standalone");
  assert.ok(data.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(data.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(data.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
});

test("service worker evita armazenar páginas autenticadas no cache estático", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(source, /legadocar-static-v1/);
  assert.match(source, /STATIC_ASSETS\.includes/);
  assert.doesNotMatch(source, /\/garagem/);
  assert.doesNotMatch(source, /\/perfil/);
});

test("perfil oferece instalação dispensável e guarda a preferência localmente", async () => {
  const source = await readFile(new URL("../src/app/perfil/page.js", import.meta.url), "utf8");

  assert.match(source, /legadocar:pwa-install-promotion-dismissed/);
  assert.match(source, /Fechar sugestão de instalação/);
  assert.match(source, /Mostrar opção de instalar o LegadoCar/);
  assert.match(source, /setItem\(PWA_INSTALL_PROMOTION_DISMISSED_KEY, "true"\)/);
  assert.match(source, /removeItem\(PWA_INSTALL_PROMOTION_DISMISSED_KEY\)/);
  assert.ok(source.indexOf("Instale o LegadoCar") < source.indexOf('aria-label="Seções do perfil"'));
});
