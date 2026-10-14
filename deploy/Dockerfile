# The portal is built and tested in containers: nothing is installed on the machine (Annex H, rule 6).
# `npm ci` installs exactly what package-lock.json says, so what is tested is what is shipped.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# `docker build --target test` fails the build when the types or a test fail.
FROM deps AS test
COPY . .
RUN npm run typecheck && npm test

# The production build: the type check, then the remote with Module Federation.
FROM deps AS build
COPY . .
# remoteEntry.js is what the shell loads: a build without it must not pass.
RUN npm run typecheck && npm run build && test -f dist/remoteEntry.js
# Annex H, checked on the COMPILED code: a portal does not know where the gateway is and does not handle a token.
RUN ! grep -rEl "localhost:8000|Authorization|Bearer" dist
