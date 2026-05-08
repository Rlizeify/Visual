# Decision: OAuth Token Encryption Strategy

**Date**: 2026-05-08
**Status**: Accepted
**Context**: Life Score feature requires storing OAuth tokens for Spotify, Discord, YouTube, MyNetDiary, and Apple integrations.

## Options Considered

### Option A: Supabase Vault
- **Pros**: Built-in secret management, automatic rotation support, seamless Supabase integration
- **Cons**: Requires Vault to be enabled (Pro plan feature), adds external dependency for secret retrieval, more complex setup

### Option B: pgcrypto (PGP symmetric encryption)
- **Pros**: Built into PostgreSQL, works on all Supabase plans, simple API, no external dependencies
- **Cons**: Requires manual key management, encryption key must be stored securely (env var or Vault)

## Decision

**Chosen: pgcrypto** with symmetric encryption (`pgp_sym_encrypt` / `pgp_sym_decrypt`)

## Rationale

1. **Availability**: pgcrypto is available on all Supabase plans including free tier
2. **Simplicity**: Two helper functions (`encrypt_token`, `decrypt_token`) encapsulate all encryption logic
3. **Security**: PGP symmetric encryption with a strong key is sufficient for OAuth tokens
4. **Flexibility**: Encryption key can be stored in Supabase Vault (if available) or as an environment variable

## Implementation

- Tokens stored as `bytea` columns (`access_token_encrypted`, `refresh_token_encrypted`)
- Helper functions in migration: `encrypt_token(token, key)`, `decrypt_token(encrypted_token, key)`
- Functions are `security definer` — only callable with service role, not from client
- Encryption key should be stored in:
  - **Production**: Supabase Vault or server-side environment variable
  - **Development**: `.env.local` as `SUPABASE_ENCRYPTION_KEY` (never commit)

## Key Rotation

To rotate the encryption key:
1. Decrypt all tokens with old key
2. Re-encrypt with new key
3. Update key in Vault/env

Consider implementing a key rotation function if token volume grows significantly.
