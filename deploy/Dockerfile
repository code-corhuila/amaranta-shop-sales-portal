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

# What ships: static files behind nginx, and nothing from node_modules. It is the LAST stage, so a plain
# `docker build` produces this one.
FROM nginx:1.27-alpine AS serve
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/portal-headers.conf /etc/nginx/snippets/portal-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 4202
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:4202/health || exit 1
