export const VERIFICATION_CODE_LENGTH = 6;
// Controle temporário de UX. O backend deverá aplicar o limite real de reenvio.
export const CODE_RESEND_WAIT_SECONDS = 120;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PERSON_NAME_PATTERN = /^[\p{L}\s'-]+$/u;
const PASSWORD_NUMBER_PATTERN = /\d/;
const PASSWORD_SPECIAL_CHARACTER_PATTERN = /[^\p{L}\p{N}\s]/u;

export function createEmptyCode() {
  return Array.from({ length: VERIFICATION_CODE_LENGTH }, () => "");
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value.trim());
}

export function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatCnpj(value) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function hasRepeatedDigits(value) {
  return /^(\d)\1+$/.test(value);
}

function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) return false;

  for (let digitIndex = 9; digitIndex <= 10; digitIndex += 1) {
    const sum = cpf
      .slice(0, digitIndex)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (digitIndex + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    const expectedDigit = remainder === 10 ? 0 : remainder;
    if (expectedDigit !== Number(cpf[digitIndex])) return false;
  }

  return true;
}

function calculateCnpjDigit(base, weights) {
  const sum = base
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) return false;

  const firstDigit = calculateCnpjDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateCnpjDigit(`${cnpj.slice(0, 12)}${firstDigit}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
}

export function getAccountNameValidationError(name) {
  const normalizedName = name.trim().replace(/\s+/g, " ");

  if (!normalizedName) return "Informe seu nome ou nome fantasia.";
  if (normalizedName.length < 2) return "O nome precisa ter pelo menos 2 caracteres.";
  if (!/\p{L}/u.test(normalizedName)) return "O nome precisa conter pelo menos uma letra.";
  return "";
}

export function getPersonNameValidationError(name) {
  const normalizedName = name.trim().replace(/\s+/g, " ");

  if (!normalizedName) return "Informe seu nome completo.";
  if (!PERSON_NAME_PATTERN.test(normalizedName)) {
    return "Use somente letras, espaços, apóstrofos e hífens no nome.";
  }
  const nameParts = normalizedName.split(" ");
  if (nameParts.length < 2) return "Informe seu nome e sobrenome.";
  if (nameParts.some((part) => !/\p{L}/u.test(part))) {
    return "Cada parte do nome precisa conter pelo menos uma letra.";
  }
  return "";
}

export function getDocumentValidationError(document, accountType) {
  const digits = onlyDigits(document);

  if (accountType === "business") {
    if (!digits) return "Informe o CNPJ.";
    if (digits.length !== 14) return "Digite os 14 dígitos do CNPJ.";
    if (!isValidCnpj(digits)) return "Digite um CNPJ válido.";
    return "";
  }

  if (!digits) return "Informe o CPF.";
  if (digits.length !== 11) return "Digite os 11 dígitos do CPF.";
  if (!isValidCpf(digits)) return "Digite um CPF válido.";
  return "";
}

export function getPasswordValidationError(password) {
  if (!password) return "Crie uma senha.";
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";

  const hasNumber = PASSWORD_NUMBER_PATTERN.test(password);
  const hasSpecialCharacter = PASSWORD_SPECIAL_CHARACTER_PATTERN.test(password);

  if (!hasNumber && !hasSpecialCharacter) {
    return "Inclua pelo menos um número e um caractere especial.";
  }
  if (!hasNumber) return "Inclua pelo menos um número.";
  if (!hasSpecialCharacter) return "Inclua pelo menos um caractere especial.";
  return "";
}
