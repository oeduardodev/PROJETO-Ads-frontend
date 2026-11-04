# API contract mirror

The canonical v1 OpenAPI document lives in the backend repository at
apps/api/openapi/public-v1.json. Copy that reviewed JSON here when the public
API changes, then run pnpm api:generate. The generated Angular client is
committed under apps/web/src/app/core/api/generated/; CI regenerates it and
checks that the working tree stays clean.
