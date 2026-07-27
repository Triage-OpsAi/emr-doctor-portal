# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM ${NODE_IMAGE} AS builder

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN node -e "const value=process.env.NEXT_PUBLIC_API_URL; if(!value) throw new Error('NEXT_PUBLIC_API_URL is required'); const url=new URL(value); if(!/^https?:$/.test(url.protocol)) throw new Error('NEXT_PUBLIC_API_URL must use http or https');" \
    && npm run build


FROM ${NODE_IMAGE} AS runtime

ARG APP_UID=10001
ARG APP_GID=10001

LABEL org.opencontainers.image.title="Meridian Doctor Portal" \
      org.opencontainers.image.description="Next.js clinical workspace for the Meridian Health AI platform"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid "${APP_GID}" app \
    && adduser --system --uid "${APP_UID}" --ingroup app app

WORKDIR /app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app

EXPOSE 3000

STOPSIGNAL SIGTERM

CMD ["node", "server.js"]
