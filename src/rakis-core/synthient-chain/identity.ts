import { ChainIdentity } from "./db/entities";
import { decryptData, encryptData } from "./utils/simple-crypto";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { getDeviceInfo } from "./utils/utils";
import { loadSettings } from "./thedomain/settings";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const identityEncryptedKey = loadSettings().identityEncryptedKey;

// Personal persisted information about this particular client
export type ClientInfo = {
  synthientId: string;
  // Storing this in the browser for now, this is meant to be ephemeral anyway - actual incentives should ideally be connected to your chain address and claimed
  synthientPrivKey: string;
  chainIds: ChainIdentity[];
  deviceInfo?: string; // To measure heterogeneity of the network, we'll likely disable this after the stability test
};

let clientInfo: ClientInfo;

export function createNewEmptyIdentity(): ClientInfo {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = ed.getPublicKey(privKey);

  const newIdentity: ClientInfo = {
    synthientId: ed.etc.bytesToHex(pubKey),
    synthientPrivKey: ed.etc.bytesToHex(privKey),
    chainIds: [],
    deviceInfo: getDeviceInfo(),
  };

  return newIdentity;
}

export async function saveIdentity(identity: ClientInfo, password: string) {
  // Encrypt and save
  const encryptedIdentity: string = await encryptData(identity, password);

  localStorage.setItem(identityEncryptedKey, encryptedIdentity);
}

export async function initClientInfo(
  password: string,
  overwrite: boolean = false
): Promise<ClientInfo> {
  if (clientInfo) return clientInfo;

  if (!overwrite && localStorage.getItem(identityEncryptedKey) && password) {
    // Decrypt and load
    try {
      const encrypted = localStorage.getItem(identityEncryptedKey);
      const decryptedIdentity: ClientInfo = await decryptData(
        encrypted!,
        password
      );

      if (!decryptedIdentity.synthientId) {
        console.log("Could not properly decrypt with this password");
      }

      clientInfo = decryptedIdentity;
    } catch (err) {
      console.error("Could not decrypt saved identity", err);
      throw err;
    }
  } else {
    // Create new identity and store it

    const newIdentity: ClientInfo = createNewEmptyIdentity();

    // Encrypt and save
    await saveIdentity(newIdentity, password);

    clientInfo = newIdentity;
  }

  return clientInfo;
}
