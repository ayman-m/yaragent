FROM nginx:1.27-alpine
RUN apk add --no-cache gettext openssl curl
COPY infra/nginx/templates /opt/nginx/templates
COPY infra/nginx/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
