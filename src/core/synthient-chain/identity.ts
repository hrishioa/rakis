import { ChainIdentity } from "./db/entities";
import { IDENTITY_ENCRYPTED_KEY } from "./config";
import { decryptData, encryptData } from "./simple-crypto";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// Personal persisted information about this particular client
export type ClientInfo = {
  synthientId: string;
  // Storing this in the browser for now, this is meant to be ephemeral anyway - actual incentives should ideally be connected to your chain address and claimed
  synthientPrivKey: string;
  chainIds: ChainIdentity[];
};

let clientInfo: ClientInfo;

export function createNewEmptyIdentity(): ClientInfo {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = ed.getPublicKey(privKey);

  const newIdentity: ClientInfo = {
    synthientId: ed.etc.bytesToHex(pubKey),
    synthientPrivKey: ed.etc.bytesToHex(privKey),
    chainIds: [],
  };

  return newIdentity;
}

export async function initClientInfo(
  password: string,
  overwrite: boolean = false
): Promise<ClientInfo> {
  if (clientInfo) return clientInfo;

  if (!overwrite && localStorage.getItem(IDENTITY_ENCRYPTED_KEY) && password) {
    // Decrypt and load
    try {
      const encrypted = localStorage.getItem(IDENTITY_ENCRYPTED_KEY);
      const decryptedIdentity: ClientInfo = await decryptData(
        encrypted!,
        password
      );

      if (!decryptedIdentity.synthientId) {
        console.log("Could not properly decrypt with this password");
      }

      console.log("Decrypted identity: ", decryptedIdentity);

      clientInfo = decryptedIdentity;
    } catch (err) {
      console.error("Could not decrypt saved identity", err);
      throw err;
    }
  } else {
    // Create new identity and store it

    const newIdentity: ClientInfo = createNewEmptyIdentity();

    // Encrypt and save
    const encryptedIdentity: string = await encryptData(newIdentity, password);

    localStorage.setItem(IDENTITY_ENCRYPTED_KEY, encryptedIdentity);

    console.log("Encrypted and saved to localStorage.");

    clientInfo = newIdentity;
  }

  return clientInfo;
}
