# Anki Deck: Microsoft identity platform (Entra ID) — Developer-depth for Product Managers

This deck is designed for an expert PM with intermediate identity knowledge who wants developer-level depth on Microsoft identity platform (Entra ID). Cards are based on the structure and content of the docs in `MicrosoftDocs/entra-docs` under `docs/identity-platform` (and Learn landing pages). Each note is tagged with hierarchical tags you can map to subdecks.

- Import file: `anki-entra-identity-platform.tsv`
- Note type: Basic (front/back)
- Fields: Front (Question/Prompt) \t Back (Answer) \t Tags
- Tags: `entra/*` with nested topic paths matching doc areas (e.g., `entra/protocols/oidc`, `entra/tokens/access`, `entra/apps/app-model`).

## Import instructions
1. In Anki, File > Import… and select `anki-entra-identity-platform.tsv`.
2. Type: Basic; Delimiter: Tab; Allow HTML: On; Deck: Choose a deck (you can later move by tag into subdecks).
3. After import, create Anki filtered decks or subdecks using tags (e.g., select tag `entra/protocols/*`).

## Topic outline (maps to tags)
- entra/overview
- entra/app-model
- entra/protocols
  - entra/protocols/oidc
  - entra/protocols/oauth2/auth-code
  - entra/protocols/oauth2/device-code
  - entra/protocols/oauth2/obo
  - entra/protocols/oauth2/client-credentials
  - entra/protocols/oauth2/ropc (caveats)
  - entra/protocols/saml
- entra/tokens
  - entra/tokens/id
  - entra/tokens/access
  - entra/tokens/refresh
  - entra/tokens/claims
  - entra/tokens/lifetimes
  - entra/tokens/validation
- entra/consent-permissions
- entra/tenancy
- entra/endpoints-metadata
- entra/msal
- entra/security-resilience
- entra/troubleshooting

Notes
- This deck is educational. Always verify specifics (parameter names, endpoints, constraints) in the official docs for your environment/tenant cloud.
- Some items include short “why it matters” context to aid retention.
