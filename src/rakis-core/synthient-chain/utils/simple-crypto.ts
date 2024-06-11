// This is just a stub implementation, definitely not properly fuzz tested so please don't borrow this. NEVER ROLL YOUR OWN CRYPTO, unless you're pressed for time.

import { Buffer } from "buffer";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { recoverMessageAddress, verifyMessage } from "viem";
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// TODO: only works for external accounts, which is fine for us
// and to actually do account abstraction you need to drill in
// the actual wallet client which is a massive pain
export async function verifyEthChainSignature(
  message: string,
  signature: `0x${string}`
) {
  try {
    const address = await recoverEthChainAddressFromSignature(
      message,
      signature
    );

    if (!address) {
      return false;
    }

    return await verifyMessage({
      address,
      message,
      signature,
    });
  } catch (err) {
    console.error("Could not verify signature", err);
    return false;
  }
}

export async function recoverEthChainAddressFromSignature(
  message: string,
  signature: `0x${string}`
) {
  try {
    return await recoverMessageAddress({
      message,
      signature,
    });
  } catch (err) {
    console.error("Could not recover address from signature", err);
    return null;
  }
}

export async function hashBinaryEmbedding(bEmbedding: number[]) {
  const uint8Array = new Uint8Array(bEmbedding);
  const hashBufer = await crypto.subtle.digest("SHA-256", uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBufer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

export async function hashString(str: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // TODO: replace this with the sha512, but I'm a little worried about rewriting the
  // crypto right now
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

export function verifySignatureOnJSONObject(
  pubKey: string,
  signature: string,
  obj: any
) {
  const message = JSON.stringify(obj);

  const encoder = new TextEncoder();
  const messageBytes = new Uint8Array(encoder.encode(message));

  const toBeVerified = messageBytes;

  // const signatureBytes = Buffer.from(signature, "hex");

  return ed.verify(signature, toBeVerified, pubKey);
}

export function signJSONObject(pKey: string, obj: any) {
  const message = JSON.stringify(obj);

  const encoder = new TextEncoder();
  const messageBytes = new Uint8Array(encoder.encode(message));

  const toBeSigned = messageBytes;

  const signature = ed.sign(toBeSigned, pKey);

  return ed.etc.bytesToHex(signature);
}

// Function to encrypt the JSON object
export async function encryptData(
  data: any,
  password: string
): Promise<string> {
  console.time("Encrypting info for storage");
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const jsonBytes = encoder.encode(JSON.stringify(data));
  const encryptedBytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    derivedKey,
    jsonBytes
  );

  const encryptedData = Buffer.from(encryptedBytes).toString("base64");
  const ivHex = Buffer.from(iv).toString("hex");
  const saltHex = Buffer.from(salt).toString("hex");
  console.timeEnd("Encrypting info for storage");

  return `${encryptedData}.${ivHex}.${saltHex}`;
}

// Function to decrypt the encrypted data
export async function decryptData(
  encryptedData: string,
  password: string
): Promise<any> {
  console.time("Decrypting info from storage");

  const [encryptedBase64, ivHex, saltHex] = encryptedData.split(".");
  const encryptedBytes = Buffer.from(encryptedBase64, "base64");
  const iv = Buffer.from(ivHex, "hex");
  const salt = Buffer.from(saltHex, "hex");

  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    derivedKey,
    encryptedBytes
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBytes);

  console.timeEnd("Decrypting info from storage");
  return JSON.parse(jsonString);
}

// Function to sign the encrypted data
export async function signData(
  encryptedData: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encryptedData)
  );
  return Buffer.from(signature).toString("base64");
}

// Function to verify the signature
export async function verifySignature(
  encryptedData: string,
  signature: string,
  password: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureBytes = Buffer.from(signature, "base64");
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(encryptedData)
  );
}
