FROM node:22-slim AS base
RUN corepack enable

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy bot package
COPY apps/volumetric-bot/package.json apps/volumetric-bot/

# Copy shared packages
COPY packages/canister-types/package.json packages/canister-types/

RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
WORKDIR /app

# Copy source files
COPY apps/volumetric-bot/ apps/volumetric-bot/
COPY packages/canister-types/ packages/canister-types/

# Copy web app tRPC types (needed for type import)
COPY apps/volumetric_web/src/trpc/ apps/volumetric_web/src/trpc/
COPY apps/volumetric_web/src/lib/use-cases/ apps/volumetric_web/src/lib/use-cases/
COPY apps/volumetric_web/src/types/ apps/volumetric_web/src/types/
COPY apps/volumetric_web/src/lib/options-transformer.ts apps/volumetric_web/src/lib/options-transformer.ts
COPY apps/volumetric_web/src/lib/canister-server.ts apps/volumetric_web/src/lib/canister-server.ts
COPY apps/volumetric_web/package.json apps/volumetric_web/

WORKDIR /app/apps/volumetric-bot
RUN pnpm build

# ---- Runtime ----
FROM base AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/volumetric-bot/node_modules ./apps/volumetric-bot/node_modules
COPY --from=deps /app/packages/canister-types/ ./packages/canister-types/
COPY --from=build /app/apps/volumetric-bot/dist ./apps/volumetric-bot/dist
COPY --from=build /app/apps/volumetric-bot/package.json ./apps/volumetric-bot/

WORKDIR /app/apps/volumetric-bot

ENTRYPOINT ["node", "dist/index.js"]
CMD ["run"]
