const XOR_KEY = 0x53; // 'S' for S3 — must match SecretManager / US-4.1

function encodeBase64(raw: string): string {
    if (typeof btoa === 'function') return btoa(raw);
    return Buffer.from(raw, 'binary').toString('base64');
}

function decodeBase64(encoded: string): string {
    if (typeof atob === 'function') return atob(encoded);
    return Buffer.from(encoded, 'base64').toString('binary');
}

export function obfuscateSecret(str: string): string {
    const xored = str.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join('');
    return encodeBase64(xored);
}

export function deobfuscateSecret(encoded: string): string | null {
    try {
        const str = decodeBase64(encoded);
        return str.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join('');
    } catch {
        return null;
    }
}

export const SECRET_ACCESS_KEY_ID = 'access-key-id';
export const SECRET_SECRET_ACCESS_KEY = 'secret-access-key';
