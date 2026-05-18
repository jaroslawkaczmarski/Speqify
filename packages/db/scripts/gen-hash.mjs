// Generate a PBKDF2 password hash compatible with apps/api crypto.ts.
// Usage: node packages/db/scripts/gen-hash.mjs "<password>"
const enc = new TextEncoder();
const b64url = (b) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const password = process.argv[2];
if (!password) {
  console.error('Usage: node gen-hash.mjs "<password>"');
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
  "deriveBits",
]);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
  key,
  256,
);
console.log(`pbkdf2$100000$${b64url(salt)}$${b64url(new Uint8Array(bits))}`);
