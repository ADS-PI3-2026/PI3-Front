import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getAuthErrorMessage, getAuthFieldErrors, loginWithCredentials, submitAuthRequest } from "../src/app/auth-api.js";
import { getPasswordValidationError } from "../src/app/lib/form-validation.js";

const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const apiUrl = "http://localhost:8000/api";

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("login envia apenas e-mail normalizado e senha intacta e lê o contrato real", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  const data = { access_token: "jwt-do-servidor", token_type: "bearer", expires_in: 3600, user: { id: 1, email: "pessoa@example.test" } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${apiUrl}/auth/login`);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Accept, "application/json");
    assert.deepEqual(JSON.parse(options.body), { email: "pessoa@example.test", password: " Senha!123 " });
    return jsonResponse({ status: "success", message: "Login realizado com sucesso.", data });
  };
  const result = await loginWithCredentials({ email: " Pessoa@Example.Test ", password: " Senha!123 " });
  assert.deepEqual(result.data, data);
});

test("login recusa sucesso incompleto antes de liberar acesso", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  const data = { access_token: "jwt-do-servidor", token_type: "bearer", expires_in: 3600, user: { id: 1, email: "pessoa@example.test" } };
  for (const changes of [
    { access_token: " " }, { access_token: null }, { token_type: "basic" },
    { expires_in: 0 }, { expires_in: "3600" }, { user: null }, { user: { email: "pessoa@example.test" } },
  ]) {
    globalThis.fetch = async () => jsonResponse({ status: "success", data: { ...data, ...changes } });
    await assert.rejects(loginWithCredentials({ email: "pessoa@example.test", password: "Senha!123" }), /resposta inesperada/);
  }
});

test("login com senha incorreta propaga 401 e mostra orientação em português", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => jsonResponse({ status: "error", message: "Invalid Credentials" }, 401);
  await assert.rejects(loginWithCredentials({ email: "pessoa@example.test", password: "incorreta" }), (error) => {
    assert.equal(error.status, 401);
    assert.match(getAuthErrorMessage(error), /E-mail ou senha incorretos/);
    return true;
  });
});

test("cadastro segue o contrato do Postman e extrai os dados do envelope Laravel", async () => {
  process.env.NEXT_PUBLIC_API_URL = `${apiUrl}/`;
  const requests = [];
  const user = { id: 1, name: "Pessoa Teste", email: "cadastro@example.test" };
  const payloads = [
    { name: user.name, email: user.email },
    { email: user.email, code: "123456" },
    { ...user, password: "Teste!123", password_confirmation: "Teste!123", document_type: "CPF", document: "52998224725", terms_accepted: true },
  ];
  delete payloads[2].id;
  const responses = [
    jsonResponse({ status: "success", message: "Código enviado.", data: [] }),
    jsonResponse({ status: "success", message: "E-mail verificado.", data: [] }),
    jsonResponse({ status: "success", message: "Conta criada.", data: { user, access_token: "token-de-teste" } }, 201),
  ];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, method: options.method, headers: options.headers, body: JSON.parse(options.body) });
    return responses.shift();
  };

  await submitAuthRequest("requestEmailVerification", payloads[0]);
  await submitAuthRequest("verifyEmail", payloads[1]);
  const result = await submitAuthRequest("register", payloads[2]);

  assert.deepEqual(requests.map(({ url }) => url), [
    `${apiUrl}/auth/pre-register`, `${apiUrl}/auth/validate-email`, `${apiUrl}/auth/register`,
  ]);
  requests.forEach((request, index) => {
    assert.equal(request.method, "POST");
    assert.equal(request.headers["Content-Type"], "application/json");
    assert.equal(request.headers.Accept, "application/json");
    assert.deepEqual(request.body, payloads[index]);
  });
  assert.equal(result.status, 201);
  assert.equal(result.mode, "api");
  assert.deepEqual(result.data.user, user);
  assert.equal(result.data.access_token, "token-de-teste");
});

test("sem configuração, o cadastro falha sem simular sucesso", async () => {
  delete process.env.NEXT_PUBLIC_API_URL;
  globalThis.fetch = () => assert.fail("Não deveria enviar requisição sem URL.");
  await assert.rejects(submitAuthRequest("register", {}), /conectar ao serviço/);
});

test("falha de rede não avança para uma etapa bem-sucedida", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(submitAuthRequest("requestEmailVerification", {}), /Confira sua conexão/);
});

test("422 associa os erros da API aos campos do formulário", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => jsonResponse({
    status: "error", message: "Os dados fornecidos são inválidos.",
    errors: { email: ["Este e-mail já está cadastrado."], password_confirmation: ["As senhas não coincidem."], terms_accepted: ["Aceite os termos."], document: ["CPF inválido."] },
  }, 422);
  await assert.rejects(submitAuthRequest("register", {}), (error) => {
    assert.equal(error.status, 422);
    assert.deepEqual(getAuthFieldErrors(error), {
      email: "Este e-mail já está cadastrado.", confirm: "As senhas não coincidem.", terms: "Aceite os termos.", document: "CPF inválido.",
    });
    return true;
  });
});

test("código inválido e código expirado são exibidos em português", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  for (const [message, expected] of [
    ["The verification code was not valid.", /inválido/],
    ["The verification code has expired.", /expirou/],
    ["The verification email has already been sent.", /dois minutos/],
  ]) {
    globalThis.fetch = async () => jsonResponse({ status: "error", message, errors: [] }, 422);
    await assert.rejects(submitAuthRequest("verifyEmail", {}), (error) => {
      assert.match(getAuthErrorMessage(error), expected);
      return true;
    });
  }
});

test("429 pede para aguardar sem mostrar mensagem técnica", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => jsonResponse({ message: "Too Many Attempts." }, 429);
  await assert.rejects(submitAuthRequest("verifyEmail", {}), (error) => {
    assert.match(getAuthErrorMessage(error), /Muitas tentativas/);
    return true;
  });
});

test("500 não expõe detalhes internos do backend", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => jsonResponse({ message: "SQLSTATE falha interna" }, 500);
  await assert.rejects(submitAuthRequest("register", {}), (error) => {
    assert.equal(getAuthErrorMessage(error), "O serviço está indisponível no momento. Tente novamente mais tarde.");
    return true;
  });
});

test("falhas internas não exibem dados técnicos nos campos", () => {
  const error = { status: 500, data: { errors: { email: ["SQLSTATE detalhe interno"] } } };
  assert.deepEqual(getAuthFieldErrors(error), {});
});

test("erros de validação destacam campos, inclusive o tipo do documento", () => {
  const error = { status: 422, data: { message: "The given data was invalid.", errors: { document_type: ["Escolha CPF ou CNPJ."] } } };
  assert.deepEqual(getAuthFieldErrors(error), { document: "Escolha CPF ou CNPJ." });
  assert.equal(getAuthErrorMessage(error), "Confira os campos destacados e tente novamente.");
});

test("credenciais incorretas e serviço ausente têm mensagens coerentes", () => {
  assert.match(getAuthErrorMessage({ status: 401, data: { message: "Invalid Credentials" } }), /E-mail ou senha incorretos/);
  assert.match(getAuthErrorMessage({ status: 404, data: { message: "Route api\/auth\/register not found" } }), /serviço solicitado/);
});

test("timeout é diferenciado de erro de rede", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => { throw new DOMException("timed out", "TimeoutError"); };
  await assert.rejects(submitAuthRequest("register", {}), /demorou para responder/);
});

test("HTML e JSON malformado não são aceitos como confirmação", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  for (const response of [
    new Response("<html>Gateway</html>", { headers: { "Content-Type": "text/html" } }),
    new Response("{", { headers: { "Content-Type": "application/json" } }),
  ]) {
    globalThis.fetch = async () => response;
    await assert.rejects(submitAuthRequest("verifyEmail", {}), /resposta inesperada/);
  }
});

test("HTTP 200 com status error não confirma o e-mail", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => jsonResponse({ status: "error", message: "Código inválido." });
  await assert.rejects(submitAuthRequest("verifyEmail", {}), (error) => error.data.status === "error");
});

test("senha exige letras, números e símbolos como a API", () => {
  assert.notEqual(getPasswordValidationError("1234567!"), "");
  assert.notEqual(getPasswordValidationError("abcdefgh!"), "");
  assert.notEqual(getPasswordValidationError("Abcdef12"), "");
  assert.equal(getPasswordValidationError("Abcdef!123"), "");
});

test("recuperação usa as rotas publicadas na API e confirmação de senha em snake_case", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return jsonResponse({ status: "success", message: "OK", data: null });
  };
  await submitAuthRequest("requestPasswordReset", { email: "conta@example.test" });
  await submitAuthRequest("verifyPasswordCode", { email: "conta@example.test", code: "123456" });
  await submitAuthRequest("resetPassword", { email: "conta@example.test", password: "Nova!123", password_confirmation: "Nova!123" });
  assert.deepEqual(requests.map(({ url }) => url), [
    `${apiUrl}/auth/forgot-password`, `${apiUrl}/auth/validate-reset-code`, `${apiUrl}/auth/reset-password`,
  ]);
  assert.deepEqual(requests[2].body, { email: "conta@example.test", password: "Nova!123", password_confirmation: "Nova!123" });
});
