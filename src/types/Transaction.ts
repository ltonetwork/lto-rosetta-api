import {
    IMassTransferTransaction,
    ITransaction,
    ITransferTransaction,
    WithSender
} from "@lto-network/lto-transactions";
import {WithId} from "@lto-network/lto-transactions/dist/transactions";
import {WithProofs} from "@lto-network/lto-transactions/src/transactions";
import {apiCall} from "../utils/utils";
import {API_BASE, CHAIN_ID, BURN_ACTIVATION_HEIGHT} from "../secrets/secrets";
import {Block} from "./Block";
import {IOperation, Operation} from "./Operation";
import {address} from "@lto-network/lto-crypto";

export interface ITransactionIdentifier {
    hash: string
}

export interface IApiTransaction extends ITransaction, WithId, WithProofs, WithSender, WithHeight {
}

export interface IGenesisTransaction extends IApiTransaction {
    recipient: string,
    amount: number
}

export interface WithSenderAddress {
    sender: string
}


interface WithHeight {
    height: number;
}

export class Transaction {

    private readonly hash: string;
    private readonly id: string;
    private readonly type: Number;
    private readonly body: IApiTransaction & WithHeight;
    private readonly block: Block;


    constructor(tx: IApiTransaction & WithHeight, block?: Block) {
        this.id = tx.id;
        this.hash = tx.id;
        this.type = tx.type;
        this.body = tx;
        this.block = block;
    }

    getHash() {
        return this.hash;
    }

    static async createFromIdentifier(transactionIdentifier: ITransactionIdentifier) {
        const txDetails = await apiCall(`${API_BASE}/transactions/info/${transactionIdentifier.hash}`) as IApiTransaction & WithHeight;
        const block = await new Block(txDetails.height).fetch();
        return new this(txDetails, block);
    }

    getOperations(): Promise<Array<IOperation>> {
        switch (this.type) {
            // Fees & Rewards as operations
            case 0: {
                return this.getRewardWithFeesOperations();
            }
            case 1: {
                return this.getGenesisOperations();
            }
            case 2: {
                return this.getPaymentOperations();
            }
            case 4: {
                return this.getTransferOperations();
            }
            case 11: {
                return this.getMassTransferOperations();
            }
        }
    }


    private getGenesisOperations(): Promise<Array<IOperation>> {
        const body = this.body as IGenesisTransaction;
        return Promise.resolve([
            Operation.create(0, body.recipient, body.amount)
        ]);
    }

    private async getPaymentOperations(): Promise<Array<IOperation>> {
        const body = this.body as IGenesisTransaction & { sender: string };
        return [
            // Sending amount
            Operation.create(0, body.sender, -body.amount),
            Operation.create(1, body.recipient, body.amount),
            Operation.create(2, body.recipient, body.amount),

            // Fee for sender
            // {
            //     operation_identifier: {
            //         index: 2
            //     },
            //     type: OperationTypes.Transfer,
            //     status: OperationStatusValues.Success,
            //     account: new Account(body.sender).getIdentifier(),
            //     amount: new Amount(-1 * Number(body.fee)).getObject()
            // },
            // Fee for block producer (Moved to tx level)
            // {
            //     operation_identifier: {
            //         index: 3
            //     },
            //     type: OperationTypes.Transfer,
            //     status: OperationStatusValues.Success,
            //     account: new Account(blockGenerator).getIdentifier(),
            //     amount: new Amount(body.fee)
            // }
        ]
    }

    private getTransferOperations(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ITransferTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        return Promise.resolve([
            Operation.create(0, body.recipient, body.amount),
            Operation.create(1, senderAddress, -body.amount)
        ]);
    }

    private getMassTransferOperations(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IMassTransferTransaction & WithSenderAddress;
        let operationId = 0;
        const resultArray: Array<IOperation> = [];
        body.transfers.forEach((transfer) => {
            resultArray.push(
                Operation.create(operationId++, transfer.recipient, transfer.amount),
                Operation.create(operationId++, body.sender, -transfer.amount)
            )
        });
        return Promise.resolve(resultArray);
    }

    private async getRewardWithFeesOperations(): Promise<Array<IOperation>> {
        const blockGenerator = await this.block.getGenerator();
        const prevBlock = await new Block(this.block.getHeight() - 1).fetch();
        const burned = this.block.getHeight() >= BURN_ACTIVATION_HEIGHT ? 10000000 : 0;
        const prevFee = (prevBlock.getBody().totalFee - (prevBlock.getBody().transactionCount * burned)) * 0.6;
        const curFee = (this.block.getBody().totalFee - (this.block.getBody().transactionCount * burned)) * 0.4;

        return Promise.resolve([
            Operation.create(0, blockGenerator, prevFee),
            Operation.create(1, blockGenerator, curFee)
        ]);
    }

    getIdentifier() {
        return {
            hash: this.hash
        }
    }

    getHeight() {
        return this.body.height;
    }

    getBody() {
        return this.body;
    }
}
