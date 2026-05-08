import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { nanoid } from 'nanoid';
import { getDb } from './db.js';

// ── Environment / RP configuration ──────────────────────────────────────────

/** The Relying Party origin. In production this must match the browser origin exactly. */
export const RP_ID = process.env.WEBAUTHN_RP_ID ?? 'localhost';

/** Human-readable name shown in the platform authenticator UI. */
export const RP_NAME = process.env.WEBAUTHN_RP_NAME ?? 'NexRev';

/**
 * Allowed origins for WebAuthn verification.
 * Supports comma-separated values, e.g. "https://app.example.com,https://www.example.com".
 */
function parseExpectedOrigins(): string[] {
  const raw = process.env.WEBAUTHN_ORIGIN;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'WEBAUTHN_ORIGIN env var is required in production. ' +
        'Set it to your app origin (e.g. https://app.example.com).'
      );
    }
    console.warn('⚠️  WEBAUTHN_ORIGIN env var not set — using http://localhost:5173 for development.');
    return ['http://localhost:5173'];
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function getExpectedOrigin(): string | string[] {
  const parts = parseExpectedOrigins();
  return parts.length === 1 ? parts[0] : parts;
}

const VALID_TRANSPORTS = new Set<AuthenticatorTransportFuture>(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);

function safeParseTransports(transports: string | null, passkeyId: string): AuthenticatorTransportFuture[] | undefined {
  if (!transports) return undefined;
  try {
    const parsed = JSON.parse(transports) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (value): value is AuthenticatorTransportFuture =>
        typeof value === 'string' && VALID_TRANSPORTS.has(value as AuthenticatorTransportFuture)
    );
  } catch (err) {
    console.warn(`⚠️ Invalid passkey transports JSON for ${passkeyId}:`, err);
    return undefined;
  }
}

export function validateWebAuthnConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  if (RP_ID === 'localhost') {
    throw new Error('WEBAUTHN_RP_ID must not be localhost in production.');
  }

  const origins = parseExpectedOrigins();
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.protocol !== 'https:') {
      throw new Error(`WEBAUTHN_ORIGIN must use https in production: ${origin}`);
    }
    if (url.hostname !== RP_ID && !url.hostname.endsWith(`.${RP_ID}`)) {
      throw new Error(`WEBAUTHN_ORIGIN hostname must match WEBAUTHN_RP_ID (${RP_ID}): ${origin}`);
    }
  }
}

// ── In-memory challenge store ────────────────────────────────────────────────

interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
}

// Challenge TTL: 5 minutes
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challengeStore = new Map<string, ChallengeEntry>();

function storeChallenge(key: string, challenge: string): void {
  challengeStore.set(key, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

function consumeChallenge(key: string): string | null {
  const entry = challengeStore.get(key);
  challengeStore.delete(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.challenge;
}

// ── DB helpers ───────────────────────────────────────────────────────────────

interface PasskeyRow {
  id: string;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: CredentialDeviceType;
  backed_up: 0 | 1;
  transports: string | null;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: CredentialDeviceType;
  backedUp: boolean;
}

function getUserIdByUsername(username: string): number | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username) as { id: number } | undefined;
  return row?.id ?? null;
}

function getPasskeysByUserId(userId: number): PasskeyRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM passkeys WHERE user_id = ?')
    .all(userId) as PasskeyRow[];
}

function getPasskeyByCredentialId(credentialId: string): PasskeyRow | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM passkeys WHERE credential_id = ?')
    .get(credentialId) as PasskeyRow | undefined;
  return row ?? null;
}

// ── Registration ─────────────────────────────────────────────────────────────

export async function generatePasskeyRegistrationOptions(
  username: string
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const userId = getUserIdByUsername(username);
  if (!userId) throw new Error('User not found');

  const existingPasskeys = getPasskeysByUserId(userId);
  const excludeCredentials = existingPasskeys.map((pk) => ({
    id: pk.credential_id,
    transports: safeParseTransports(pk.transports, pk.id),
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    userDisplayName: username,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  storeChallenge(`reg:${username}`, options.challenge);
  return options;
}

export async function verifyPasskeyRegistration(
  username: string,
  response: RegistrationResponseJSON,
  passkeyName: string
): Promise<PasskeyInfo> {
  const expectedChallenge = consumeChallenge(`reg:${username}`);
  if (!expectedChallenge) throw new Error('Registration challenge expired or not found');

  const userId = getUserIdByUsername(username);
  if (!userId) throw new Error('User not found');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getExpectedOrigin(),
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration verification failed');
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();

  const transports = response.response.transports
    ? JSON.stringify(response.response.transports)
    : null;

  db.prepare(`
    INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, device_type, backed_up, transports, name, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    id,
    userId,
    credential.id,
    Buffer.from(credential.publicKey).toString('base64'),
    credential.counter,
    credentialDeviceType,
    credentialBackedUp ? 1 : 0,
    transports,
    passkeyName || 'Passkey',
    now
  );

  return {
    id,
    name: passkeyName || 'Passkey',
    createdAt: now,
    lastUsedAt: null,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
  };
}

// ── Authentication ────────────────────────────────────────────────────────────

export async function generatePasskeyAuthenticationOptions(
  username: string
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const userId = getUserIdByUsername(username);
  if (!userId) throw new Error('User not found');

  const existingPasskeys = getPasskeysByUserId(userId);
  if (existingPasskeys.length === 0) throw new Error('No passkeys registered for this user');

  const allowCredentials = existingPasskeys.map((pk) => ({
    id: pk.credential_id,
    transports: safeParseTransports(pk.transports, pk.id),
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials,
  });

  storeChallenge(`auth:${username}`, options.challenge);
  return options;
}

export async function verifyPasskeyAuthentication(
  username: string,
  response: AuthenticationResponseJSON
): Promise<boolean> {
  const expectedChallenge = consumeChallenge(`auth:${username}`);
  if (!expectedChallenge) throw new Error('Authentication challenge expired or not found');

  const passkey = getPasskeyByCredentialId(response.id);
  if (!passkey) throw new Error('Passkey not found');

  // Ensure the passkey belongs to the claimed user
  const userId = getUserIdByUsername(username);
  if (!userId || passkey.user_id !== userId) throw new Error('Passkey does not belong to user');

  const publicKeyBytes = new Uint8Array(Buffer.from(passkey.public_key, 'base64'));

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getExpectedOrigin(),
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credential_id,
      publicKey: publicKeyBytes,
      counter: passkey.counter,
      transports: safeParseTransports(passkey.transports, passkey.id),
    },
    requireUserVerification: false,
  });

  if (!verification.verified) return false;

  // Update counter and last_used_at
  const db = getDb();
  db.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?').run(
    verification.authenticationInfo.newCounter,
    new Date().toISOString(),
    passkey.id
  );

  return true;
}

// ── Management ────────────────────────────────────────────────────────────────

export function listPasskeys(username: string): PasskeyInfo[] {
  const userId = getUserIdByUsername(username);
  if (!userId) return [];

  return getPasskeysByUserId(userId).map((pk) => ({
    id: pk.id,
    name: pk.name,
    createdAt: pk.created_at,
    lastUsedAt: pk.last_used_at,
    deviceType: pk.device_type,
    backedUp: pk.backed_up === 1,
  }));
}

export function deletePasskey(username: string, passkeyId: string): boolean {
  const userId = getUserIdByUsername(username);
  if (!userId) return false;

  const db = getDb();
  const result = db
    .prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?')
    .run(passkeyId, userId);
  return result.changes > 0;
}

export function renamePasskey(username: string, passkeyId: string, name: string): boolean {
  const userId = getUserIdByUsername(username);
  if (!userId) return false;

  const db = getDb();
  const result = db
    .prepare('UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ?')
    .run(name, passkeyId, userId);
  return result.changes > 0;
}
