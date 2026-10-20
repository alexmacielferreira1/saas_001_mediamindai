// Saudação única (Home e Corp): madrugada (antes das 6h) e a partir das 18h é noite.
export function getGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6 || h >= 18) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  return 'Boa tarde';
}
