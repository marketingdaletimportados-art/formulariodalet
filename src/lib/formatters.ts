export function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""));
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}

export function isValidCPF(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

export function maskCPFDisplay(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.***.***-${c.slice(9)}`;
}

export function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Normaliza telefone para formato internacional E.164 (apenas dígitos), assumindo
 * Brasil quando o número tem 10 ou 11 dígitos e não começa com 55.
 * Retorna null se o resultado não estiver entre 12 e 15 dígitos.
 */
export function normalizePhoneE164(v: string): string | null {
  const d = v.replace(/\D/g, "");
  if (!d) return null;
  let out = d;
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) {
    out = "55" + d;
  }
  if (out.length < 12 || out.length > 15) return null;
  return out;
}

/**
 * Valida nome pessoal: apenas letras (com acentos), espaços, apóstrofo e hífen.
 * Exige pelo menos 3 caracteres e ao menos 2 letras. Rejeita se contiver dígitos.
 */
export function isValidPersonName(v: string): boolean {
  const s = v.trim();
  if (s.length < 3) return false;
  if (/\d/.test(s)) return false;
  if (!/^[\p{L}\s'’\-]+$/u.test(s)) return false;
  const letterCount = (s.match(/\p{L}/gu) ?? []).length;
  return letterCount >= 2;
}

/**
 * Valida número do pedido: letras, números, hífen, barra e underscore.
 * 1 a 40 caracteres, não pode ser somente espaços.
 */
export function isValidOrderNumber(v: string): boolean {
  const s = v.trim();
  if (s.length < 1 || s.length > 40) return false;
  return /^[A-Za-z0-9\-\/_]+$/.test(s);
}
