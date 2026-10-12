# Offline/CI variant of apps/web/Dockerfile: packages a `next build` standalone output produced on the host.
FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --chown=node:node apps/web/.next/standalone ./
COPY --chown=node:node apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/brand/mark.svg').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
