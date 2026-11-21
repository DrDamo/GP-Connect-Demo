#!/bin/sh
# Starts the HL7 validator in server mode. Terminology:
#   TX_URL + TX_TOKEN set -> the app's internal passthrough to the NHS England
#                            Terminology Server (server/src/txProxy.ts)
#   otherwise             -> none (-tx n/a); codes are not checked
set -eu

IG_ARGS=""
for ig in $IGS; do IG_ARGS="$IG_ARGS -ig $ig"; done
# GP Connect code systems/value sets missing from those packages (see its README).
IG_ARGS="$IG_ARGS -ig $HOME/extra-terminology"

if [ -n "${TX_URL:-}" ] && [ -n "${TX_TOKEN:-}" ]; then
  # The passthrough is plain http on the Docker network, which the validator
  # only allows for servers listed here; the token is sent as a bearer token.
  mkdir -p "$HOME/.fhir"
  umask 077
  printf '{"servers":[{"url":"%s","type":"fhir","allowHttp":true,"allowPrivateNetwork":true,"authenticationType":"token","token":"%s"}]}\n' \
    "$TX_URL" "$TX_TOKEN" > "$HOME/.fhir/fhir-settings.json"
  TX_ARGS="-tx $TX_URL -authorise-non-conformant-tx-servers"
  echo "Terminology: $TX_URL"
else
  rm -f "$HOME/.fhir/fhir-settings.json"
  TX_ARGS="-tx n/a"
  echo "Terminology: none"
fi

# shellcheck disable=SC2086
exec java $JAVA_OPTS -jar validator_cli.jar server 8080 -allowNetworkAccess -version 3.0.2 $IG_ARGS $TX_ARGS
