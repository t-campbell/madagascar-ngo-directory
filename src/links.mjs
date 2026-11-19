export function safeWeb(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname && !url.username && !url.password);
  } catch {
    return false;
  }
}

export function methodHref({ type, value, href }) {
  if (type === 'phone') {
    const number = value.replace(/[ .()-]/g, '');
    if (!/^\+?\d{5,16}$/.test(number)) return null;
    const expected = 'tel:' + number;
    return href === undefined || href === expected ? expected : null;
  }
  if (type === 'email') {
    if (!/^[a-z0-9.!'+_-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(value)) return null;
    const expected = 'mailto:' + value.replaceAll('+', '%2B');
    return href === undefined || href === expected || href === 'mailto:' + value ? expected : null;
  }
  if (type === 'whatsapp') {
    const number = value.replace(/[ .()-]/g, '');
    const expected = 'https://wa.me/' + number.slice(1);
    return /^\+\d{7,15}$/.test(number) && (href === undefined || href === expected) ? expected : null;
  }
  if (type === 'website' || type === 'web_form') {
    return safeWeb(value) && (href === undefined || href === value) ? value : null;
  }
  return null;
}
