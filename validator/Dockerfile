# GP Connect STU3 profile validator: the HL7 FHIR validator (validator_cli)
# in its HTTP server mode, with the GP Connect and CareConnect STU3 packages
# baked in so it runs with no internet access (the VPS `internal` network).
# Terminology: off by default (-tx n/a). With TX_URL and TX_TOKEN set, codes
# are checked against the NHS England Terminology Server through the app's
# internal passthrough (server/src/txProxy.ts); see start.sh. Only codes,
# displays and value set definitions are sent, never whole resources.

FROM eclipse-temurin:21.0.13_9-jre-noble

ARG VALIDATOR_VERSION=7.0.3
ARG VALIDATOR_SHA256=57aa43fb40cec5de41def81c927725fd85908eeb71509b7f9313e04d9b8ec79b
ARG IGS="uk.gpc.struct#1.5.0 careconnect.stu3.03.00.00#3.1.0"

RUN useradd --create-home --uid 10001 validator
USER validator
WORKDIR /home/validator

ADD --chown=validator https://github.com/hapifhir/org.hl7.fhir.core/releases/download/${VALIDATOR_VERSION}/validator_cli.jar validator_cli.jar
RUN if [ -n "$VALIDATOR_SHA256" ]; then echo "$VALIDATOR_SHA256  validator_cli.jar" | sha256sum -c -; fi

# Validate a trivial resource once so every package (and its dependencies)
# lands in ~/.fhir/packages inside the image.
RUN echo '{"resourceType":"Basic","code":{"text":"warm-up"}}' > /tmp/warmup.json \
 && java -jar validator_cli.jar /tmp/warmup.json -version 3.0.2 $(for ig in $IGS; do printf -- '-ig %s ' "$ig"; done) -tx n/a > /dev/null \
 && rm /tmp/warmup.json

COPY --chown=validator extra-terminology extra-terminology
COPY --chown=validator --chmod=755 start.sh start.sh

ENV IGS=${IGS} JAVA_OPTS="-Xmx2g"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080' || exit 1
CMD ["./start.sh"]
