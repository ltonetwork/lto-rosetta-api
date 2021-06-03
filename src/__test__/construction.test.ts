import {CurveTypesEnum, PublicKey, SignatureType} from "../types/Cryptography";
import {base16Decode} from "@waves/ts-lib-crypto";
import {base58decode, byteArrayToHexString, signWithPrivateKey} from "@lto-network/lto-crypto";

const supertest = require("supertest");
const app = require("../server");

const network_identifier =  {
    blockchain: "lto",
        network: "testnet"
};

describe('Construction API test', () => {
    let transaction: any;
    let payloads: any;
    let tx_bytes: any;

    it("Should return the account identifier associated with a public key", async () => {
        const request = {
            network_identifier,
            public_key: {
                hex_bytes: "89a4661e446b46401325a38d3b20582d1dd277eb448a3181012a671b7ae15837",
                curve_type: "edwards25519"
            },
            metadata: {}
        }

        await supertest(app).post("/construction/derive/")
            .send(request)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .then((response: any) => {
                expect(response.body.address).toBe('3MzYSqyo8GBMsY8u8F2WEuoVXYuq6hnKzyj');
            });
    });

    it('Should create an unsigned transaction', async () => {
        const request = {
            network_identifier,
            operations: [
                {
                    operation_identifier: {
                        index: 1,
                        network_index: 0
                    },
                    type: "TRANSFER",
                    account: {
                        address: "3MrZEL5jGBE81sFzWjEvWtzKNHfDiNZ99wh"
                    },
                    amount: {
                        value: "10000000",
                        currency: {
                            symbol: "LTO",
                            decimals: 8
                        }
                    },
                    metadata: {
                        public_key: {
                            hex_bytes: "89a4661e446b46401325a38d3b20582d1dd277eb448a3181012a671b7ae15837",
                            curve_type: "edwards25519"
                        }
                    }
                }
            ],
            "metadata": {}
        }


        await supertest(app).post("/construction/payloads/")
            .send(request)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .then((response: any) => {
                expect(response.body.unsigned_transaction).toBeDefined()
                expect(response.body.payloads).toBeDefined()
                transaction = response.body.unsigned_transaction;
                tx_bytes = response.body.unsigned_transaction;
                payloads = response.body.payloads;
            });
    })

    it('Should parse transaction' , async () => {
        const request = {
            network_identifier,
            transaction,
            signed: false
        };

        await supertest(app).post("/construction/parse")
            .send(request)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
    })

    it('Should combine transaction with signature' , async () => {
        const publicKey = new PublicKey('89a4661e446b46401325a38d3b20582d1dd277eb448a3181012a671b7ae15837', CurveTypesEnum.ED25519);
        const hex_bytes = byteArrayToHexString(base58decode(signWithPrivateKey(base16Decode(tx_bytes),
            '5gqCU5NbwU4gc62be39LXDDALKj8opj1KZszx7ULJc2k33kk52prn8D1H2pPPwm6QVKvkuo72YJSoUhzzmAFmDH8')));
        const public_key =  {hexBytes: publicKey.hexBytes, curveType: publicKey.curveType}
        const signature = {hex_bytes, ["signature_type"]: SignatureType.ED25519, ["signing_payload"]: payloads[0], public_key}

        const account_identifier = {
            address: publicKey.deriveAddress()
        }
        signature.signing_payload = {...signature.signing_payload, account_identifier}

        const request = {
            network_identifier,
            unsigned_transaction: transaction,
            signatures: [signature]
        };

        await supertest(app).post("/construction/combine")
            .send(request)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .then((response: any) => {
                expect(response.body.signed_transaction).toBeDefined()
                transaction = response.body.signed_transaction;
            });
    })

    it('Should return network-specific transaction hash for a signed transaction' , async () => {
        const request = {
            network_identifier,
            signed_transaction: transaction,
        };

        await supertest(app).post("/construction/hash")
            .send(request)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .then((response: any) => {
                expect(response.body.transaction_identifier).toBeDefined()
            });
    })

    it('Should submit a pre-signed transaction to the node' , async () => {
        console.log(transaction)
        const request = {
            network_identifier,
            signed_transaction: transaction,
        };

        await supertest(app).post("/construction/submit")
            .send(request)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .then((response: any) => {
                expect(response.body.transaction_identifier).toBeDefined()

            });
    })
})
