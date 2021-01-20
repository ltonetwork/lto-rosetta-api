#!/bin/bash

# Run nodejs
cd /usr/src/app/dist/ && forever start server.js
NETWORKS="mainnet testnet"
mkdir -p /var/lib/lto/log

if [ ! -f "${LTO_CONFIG_FILE}" ]; then
  echo "Custom '${LTO_CONFIG_FILE}' not found. Using a default one for '${LTO_NETWORK,,}' network." | tee -a /var/log/lto/lto.log
  if [[ $NETWORKS == *"${LTO_NETWORK,,}"* ]]; then
    cp /usr/share/lto/conf/lto-${LTO_NETWORK}.conf "${LTO_CONFIG_FILE}"
    sed -i 's/include "local.conf"//' "${LTO_CONFIG_FILE}"
#    for f in /etc/lto/ext/*.conf; do
#      echo "Adding $f extension config to lto.conf";
#      echo "include required(\"$f\")" >> ${LTO_CONFIG_FILE}
#    done
    echo 'include "local.conf"' >> "${LTO_CONFIG_FILE}"
  else
    echo "Network '${LTO_NETWORK,,}' not found. Exiting."
    exit 1
  fi
else
  echo "Found custom '${LTO_CONFIG_FILE}'. Using it."
fi

if [ "${LTO_VERSION}" == "latest" ]; then
  filename=$(find /usr/share/lto/lib -name lto-all* -printf '%f\n')
  export LTO_VERSION=$(echo ${filename##*-} | cut -d\. -f1-3)
fi

/usr/bin/python3 "/lto-node/starter.py"

echo "Node is starting..." | tee -a /var/log/lto/lto.log
echo "LTO_HEAP_SIZE='${LTO_HEAP_SIZE}'" | tee -a /var/log/lto/lto.log
echo "LTO_LOG_LEVEL='${LTO_LOG_LEVEL}'" | tee -a /var/log/lto/lto.log
echo "LTO_VERSION='${LTO_VERSION}'" | tee -a /var/log/lto/lto.log
echo "LTO_NETWORK='${LTO_NETWORK}'" | tee -a /var/log/lto/lto.log
echo "LTO_WALLET_SEED='${LTO_WALLET_SEED}'" | tee -a /var/log/lto/lto.log
echo "LTO_WALLET_PASSWORD='${LTO_WALLET_PASSWORD}'" | tee -a /var/log/lto/lto.log

${JAVA_HOME}/bin/java -Dlogback.stdout.level="${LTO_LOG_LEVEL}" "-Xmx${LTO_HEAP_SIZE}" -jar "/lto-node/lto-public-all.jar" $LTO_CONFIG_FILE
