import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loginWithCredentials, submitApiRequest } from "../src/app/auth-api.js";
import { buildLegalBootstrapUpdates } from "./lib/legal-bootstrap.mjs";

const { values } = parseArgs({ options: {
  "api-url": { type: "string" },
  "backend-env": { type: "string" },
} });
if (!values["api-url"]) throw new Error("Informe --api-url com a API que receberá os textos anteriores.");
process.env.NEXT_PUBLIC_API_URL = values["api-url"];
let email = process.env.LEGADO_ADMIN_EMAIL;
let password = process.env.LEGADO_ADMIN_PASSWORD;
if (values["backend-env"]) {
  const env = await readFile(values["backend-env"], "utf8");
  const value = name => env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2");
  email = value("ADMIN_EMAIL");
  password = value("ADMIN_PASSWORD");
}
if (!email || !password) throw new Error("Configure LEGADO_ADMIN_EMAIL/LEGADO_ADMIN_PASSWORD ou informe --backend-env.");
const originals = JSON.parse(await readFile(new URL("../docs/initial-legal-documents.json", import.meta.url), "utf8"));
const login = await loginWithCredentials({ email, password });
const accessToken = login.data.access_token;
const current = await submitApiRequest("/admin/settings?group=legal", { method: "GET", accessToken, cache: "no-store" });
if (!Array.isArray(current.data)) throw new Error("Resposta de configurações inválida.");
const updates = buildLegalBootstrapUpdates(current.data, originals);
if (updates.length) {
  await submitApiRequest("/admin/settings/batch", { method: "PUT", accessToken, payload: { settings: updates } });
  console.log(`Textos anteriores importados: ${updates.map(item => item.key).join(", ")}.`);
} else console.log("Nenhum texto de exemplo encontrado. Conteúdos existentes preservados.");
