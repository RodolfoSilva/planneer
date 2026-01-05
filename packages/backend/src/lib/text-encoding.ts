/**
 * Converts Windows-1252/ISO-8859-1 bytes to UTF-8 string
 * Windows-1252 is a superset of ISO-8859-1 with additional characters in 0x80-0x9F
 */
function latin1ToUtf8(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte < 0x80) {
      // ASCII range (0x00-0x7F)
      result += String.fromCharCode(byte);
    } else if (byte >= 0x80 && byte <= 0x9F) {
      // Windows-1252 specific characters (0x80-0x9F)
      // These differ from ISO-8859-1
      const charMap: Record<number, string> = {
        0x80: '\u20AC', // €
        0x82: '\u201A', // ‚
        0x83: '\u0192', // ƒ
        0x84: '\u201E', // „
        0x85: '\u2026', // …
        0x86: '\u2020', // †
        0x87: '\u2021', // ‡
        0x88: '\u02C6', // ˆ
        0x89: '\u2030', // ‰
        0x8A: '\u0160', // Š
        0x8B: '\u2039', // ‹
        0x8C: '\u0152', // Œ
        0x8E: '\u017D', // Ž
        0x91: '\u2018', // '
        0x92: '\u2019', // '
        0x93: '\u201C', // "
        0x94: '\u201D', // "
        0x95: '\u2022', // •
        0x96: '\u2013', // –
        0x97: '\u2014', // —
        0x98: '\u02DC', // ˜
        0x99: '\u2122', // ™
        0x9A: '\u0161', // š
        0x9B: '\u203A', // ›
        0x9C: '\u0153', // œ
        0x9E: '\u017E', // ž
        0x9F: '\u0178', // Ÿ
      };
      
      if (charMap[byte]) {
        result += charMap[byte];
      } else {
        // Unused bytes in Windows-1252, use ISO-8859-1 mapping
        result += String.fromCharCode(byte);
      }
    } else {
      // ISO-8859-1 range (0xA0-0xFF) - same in both encodings
      // This includes all accented characters like ç (0xE7), ã (0xE3), etc.
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

/**
 * Attempts to decode a buffer with multiple encodings and returns the best result.
 * Tries common encodings for XER/XML files: UTF-8, Windows-1252, ISO-8859-1
 */
export function decodeWithFallback(buffer: ArrayBuffer, preferredEncoding?: string): string {
  const bytes = new Uint8Array(buffer);
  
  // Try UTF-8 first (most common)
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const decoded = decoder.decode(buffer);
    
    // Check if the decoded string contains replacement characters
    if (!decoded.includes('\uFFFD')) {
      return decoded;
    }
  } catch (error) {
    // UTF-8 decoding failed, try other encodings
  }

  // Try Windows-1252/ISO-8859-1 (common in Windows-generated files)
  try {
    const decoded = latin1ToUtf8(bytes);
    // Check if result looks valid (no obvious encoding issues)
    if (decoded && !decoded.includes('\uFFFD')) {
      return decoded;
    }
  } catch (error) {
    // Latin-1 conversion failed
  }

  // Try ISO-8859-1 / Latin-1 (always works, but may not be correct)
  try {
    const decoder = new TextDecoder('latin1');
    return decoder.decode(buffer);
  } catch (error) {
    // Should never happen, but just in case
  }

  // Last resort: convert bytes directly
  return String.fromCharCode(...bytes);
}

/**
 * Detects encoding from XML declaration if present
 */
export function detectEncodingFromXML(content: string): string | undefined {
  const xmlDeclaration = content.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i);
  if (xmlDeclaration) {
    const encoding = xmlDeclaration[1].toLowerCase();
    // Map common encoding names
    const encodingMap: Record<string, string> = {
      'utf-8': 'utf-8',
      'utf8': 'utf-8',
      'windows-1252': 'windows-1252',
      'iso-8859-1': 'iso-8859-1',
      'latin1': 'iso-8859-1',
      'latin-1': 'iso-8859-1',
    };
    return encodingMap[encoding] || encoding;
  }
  return undefined;
}

/**
 * Decodes file content with encoding detection
 */
export function decodeFileContent(buffer: ArrayBuffer, fileName: string): string {
  // For XML files, try to detect encoding from declaration first
  if (fileName.toLowerCase().endsWith('.xml')) {
    // Try UTF-8 first to read the XML declaration
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
      const sample = utf8Decoder.decode(buffer.slice(0, Math.min(1024, buffer.byteLength)));
      const detectedEncoding = detectEncodingFromXML(sample);
      
      if (detectedEncoding) {
        const decoder = new TextDecoder(detectedEncoding, { fatal: false });
        return decoder.decode(buffer);
      }
    } catch (error) {
      // Fall through to fallback decoding
    }
  }

  // Use fallback decoding
  return decodeWithFallback(buffer);
}

