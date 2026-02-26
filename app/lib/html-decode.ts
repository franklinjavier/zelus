/**
 * Decode HTML entities in a string (works both client and server side)
 * @example
 * decodeHtmlEntities('&nbsp;&ccedil;&atilde;') → '  çã'
 */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&amp;': '&',
    '&cent;': '¢',
    '&pound;': '£',
    '&yen;': '¥',
    '&euro;': '€',
    '&copy;': '©',
    '&reg;': '®',
    '&times;': '×',
    '&divide;': '÷',
    '&acute;': '´',
    '&cedil;': '¸',
    '&ordf;': 'ª',
    '&ordm;': 'º',
    '&Aacute;': 'Á',
    '&aacute;': 'á',
    '&Acirc;': 'Â',
    '&acirc;': 'â',
    '&Agrave;': 'À',
    '&agrave;': 'à',
    '&Aring;': 'Å',
    '&aring;': 'å',
    '&Atilde;': 'Ã',
    '&atilde;': 'ã',
    '&Auml;': 'Ä',
    '&auml;': 'ä',
    '&AElig;': 'Æ',
    '&aelig;': 'æ',
    '&Ccedil;': 'Ç',
    '&ccedil;': 'ç',
    '&Eacute;': 'É',
    '&eacute;': 'é',
    '&Ecirc;': 'Ê',
    '&ecirc;': 'ê',
    '&Egrave;': 'È',
    '&egrave;': 'è',
    '&Euml;': 'Ë',
    '&euml;': 'ë',
    '&Iacute;': 'Í',
    '&iacute;': 'í',
    '&Icirc;': 'Î',
    '&icirc;': 'î',
    '&Igrave;': 'Ì',
    '&igrave;': 'ì',
    '&Iuml;': 'Ï',
    '&iuml;': 'ï',
    '&Ntilde;': 'Ñ',
    '&ntilde;': 'ñ',
    '&Oacute;': 'Ó',
    '&oacute;': 'ó',
    '&Ocirc;': 'Ô',
    '&ocirc;': 'ô',
    '&Ograve;': 'Ò',
    '&ograve;': 'ò',
    '&Oslash;': 'Ø',
    '&oslash;': 'ø',
    '&Otilde;': 'Õ',
    '&otilde;': 'õ',
    '&Ouml;': 'Ö',
    '&ouml;': 'ö',
    '&Uacute;': 'Ú',
    '&uacute;': 'ú',
    '&Ucirc;': 'Û',
    '&ucirc;': 'û',
    '&Ugrave;': 'Ù',
    '&ugrave;': 'ù',
    '&Uuml;': 'Ü',
    '&uuml;': 'ü',
    '&Yacute;': 'Ý',
    '&yacute;': 'ý',
    '&yuml;': 'ÿ',
  }

  let decoded = text
  // Replace named entities
  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, 'g'), char)
  })

  // Replace numeric entities like &#123; or &#xAB;
  decoded = decoded.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)))
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )

  return decoded
}
