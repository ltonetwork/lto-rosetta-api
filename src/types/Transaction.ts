import {
    IAnchorTransaction, IAssociationTransaction,
    ICancelLeaseTransaction, ILeaseTransaction,
    IMassTransferTransaction,
    ITransaction,
    ITransferTransaction,
    WithSender
} from "@lto-network/lto-transactions";
import {
    ICancelSponsorTransaction,
    IRevokeAssociationTransaction,
    ISponsorTransaction,
    WithId
} from "@lto-network/lto-transactions/dist/transactions";
import {WithProofs} from "@lto-network/lto-transactions/src/transactions";
import {apiCall} from "../utils/utils";
import {API_BASE, BURN_ACTIVATION_HEIGHT, CHAIN_ID} from "../secrets/secrets";
import {Block} from "./Block";
import {IOperation, Operation, OperationTypes} from "./Operation";
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
            case 8: {
                return this.getLeaseTransactions();
            }
            case 9: {
                return this.getCancelLeaseTransactions();
            }
            case 11: {
                return this.getMassTransferOperations();
            }
            case 15: {
                return this.getAnchorTransactions();
            }
            case 16: {
                return this.getAssociationTransactions();
            }
            case 17: {
                return this.getRevokeAssociationTransactions();
            }
            case 18: {
                return this.getSponsorTransactions();
            }
            case 19: {
                return this.getCancelSponsorTransactions();
            }
        }
    }

    private getGenesisOperations(): Promise<Array<IOperation>> {
        const body = this.body as IGenesisTransaction;
        return Promise.resolve([
            Operation.create(0, body.recipient, body.amount, OperationTypes.Genesis)
        ]);
    }

    private async getPaymentOperations(): Promise<Array<IOperation>> {
        const body = this.body as IGenesisTransaction & { sender: string };
        return [
            // Sending amount
            Operation.create(0, body.sender, -body.amount),
            Operation.create(1, body.recipient, body.amount),
            // Operation.create(2, body.recipient, body.amount),

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
        const senderAddress = body.sender ?? address(body.senderPublicKey, CHAIN_ID);

        return Promise.resolve([
            Operation.create(0, body.recipient, body.amount, OperationTypes.Transfer),
            Operation.create(1, senderAddress, -body.amount, OperationTypes.Transfer),
            Operation.create(2, senderAddress, -body.fee, OperationTypes.Transfer)
        ]);
    }

    private getLeaseTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ILeaseTransaction & WithSenderAddress;
        const senderAddress = body.sender ?? address(body.senderPublicKey, CHAIN_ID);
        return Promise.resolve([
            Operation.create(0, body.recipient, body.amount, OperationTypes.Lease),
            Operation.create(1, senderAddress, -body.amount, OperationTypes.Lease),
            Operation.create(2, senderAddress, -body.fee, OperationTypes.Lease)
        ]);
    }

    private async getCancelLeaseTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ICancelLeaseTransaction & WithSenderAddress;
        const senderAddress = body.sender ?? address(body.senderPublicKey, CHAIN_ID);
        const leaseTransaction = await apiCall(`${API_BASE}/transactions/info/${body.leaseId}`) as ILeaseTransaction ;

        return Promise.resolve([
            Operation.create(0, senderAddress, leaseTransaction.amount, OperationTypes.CancelLease),
            Operation.create(1, leaseTransaction.recipient, -leaseTransaction.amount, OperationTypes.CancelLease),
            Operation.create(2, senderAddress, -body.fee, OperationTypes.CancelLease)
        ]);
    }

    private getMassTransferOperations(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IMassTransferTransaction & WithSenderAddress;
        let operationId = 0;
        const resultArray: Array<IOperation> = [];
        body.transfers.forEach((transfer) => {
            resultArray.push(
                Operation.create(operationId++, transfer.recipient, transfer.amount, OperationTypes.MassTransfer),
                Operation.create(operationId++, body.sender, -transfer.amount, OperationTypes.MassTransfer)
            )
        });
        const massTransferFee = Operation.create(operationId++, body.sender, -body.fee, OperationTypes.MassTransfer);
        resultArray.push(massTransferFee);

        return Promise.resolve(resultArray);
    }

    private getAnchorTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IAnchorTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        return Promise.resolve([
            Operation.create(0, senderAddress, -body.fee, OperationTypes.Anchor)
        ]);
    }

    private getAssociationTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IAssociationTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        return Promise.resolve([
            Operation.create(0, senderAddress, -body.fee, OperationTypes.Association)
        ]);
    }

    private getRevokeAssociationTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IRevokeAssociationTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        return Promise.resolve([
            Operation.create(0, senderAddress, -body.fee, OperationTypes.RevokeAssociation)
        ]);
    }

    private getSponsorTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ISponsorTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        return Promise.resolve([
            Operation.create(0, senderAddress, -body.fee, OperationTypes.Sponsor)
        ]);
    }

    private getCancelSponsorTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ICancelSponsorTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        return Promise.resolve([
            Operation.create(0, senderAddress, -body.fee, OperationTypes.CancelSponsor)
        ]);
    }

    private async getRewardWithFeesOperations(): Promise<Array<IOperation>> {
        const blockGenerator = await this.block.getGenerator();
        const prevBlock = await new Block(this.block.getHeight() - 1).fetch();
        const burned = this.block.getHeight() >= BURN_ACTIVATION_HEIGHT ? 10000000 : 0;
        const prevFee = (prevBlock.getBody().totalFee - (prevBlock.getBody().transactionCount * burned)) * 0.6;
        const curFee = (this.block.getBody().totalFee - (this.block.getBody().transactionCount * burned)) * 0.4;

        return Promise.resolve([
            Operation.create(0, blockGenerator, prevFee, OperationTypes.Reward),
            Operation.create(1, blockGenerator, curFee, OperationTypes.Reward)
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
