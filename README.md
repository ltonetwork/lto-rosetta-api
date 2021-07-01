# LTO Rosetta API

LTO node with Rosetta API compatible middleware.

_This project is a fork of https://github.com/KardanovIR/waves-rosetta-api._

## Overview 
This middleware implements [Rosetta API](https://rosetta-api.org) specifications for LTO blockchain.

The docker image inherits settings from [LTO Public Node Docker Image](https://github.com/ltonetwork/lto-public-node).

## Usage

### Build docker image

The simplest way to build an image is to run the following command:

```sh
docker build . -t lto-rosetta-api
```

### Running docker image

```sh
docker run -v /lto-data:/var/lib/LTO -v lto-config:/etc/lto -p 6869:6869 -p 6862:6862 -p 8080:8080 -e JAVA_OPTS="-DLTO.rest-api.enable=yes -DLTO.rest-api.bind-address=0.0.0.0 -DLTO.rest-api.port=6869  -DLTO.wallet.password=myWalletSuperPassword" -e LTO_NETWORK=testnet -ti lto-rosetta-api

```

### Calling API

API call examples are shown [here](https://www.getpostman.com/collections/3c2028a379f2297914af).

### Configuration

LTO Network public node image configuration process is described [here](https://github.com/ltonetwork/lto-public-node#configuration).

Middleware configuration is stored in `.env` file 

## Tests

Use [Rosetta CLI](https://github.com/coinbase/rosetta-cli) to run tests for this middleware.

