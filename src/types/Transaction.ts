import {
    IAnchorTransaction, IAssociationTransaction,
    ICancelLeaseTransaction, IDataTransaction, ILeaseTransaction,
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
import {ISetScriptTransaction, WithProofs} from "@lto-network/lto-transactions/src/transactions";
import {apiCall} from "../utils/utils";
import {API_BASE, BURN_ACTIVATION_HEIGHT, CHAIN_ID} from "../secrets/secrets";
import {Block} from "./Block";
import {IOperation, Operation, OperationTypes} from "./Operation";
import {address} from "@lto-network/lto-crypto";
const storage = require('node-persist');

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

class Sponsorship {
    recipient: string;
    sponsor: string;
    height: number;

    constructor(recipient: string, sponsor: string, height: number) {
        this.recipient = recipient;
        this.sponsor = sponsor;
        this.height = height;
    }
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
            case 12: {
                return this.getDataTransactions();
            }
            case 13: {
                return this.getSetScriptTransaction();
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

    private async getTransferOperations(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ITransferTransaction & WithSenderAddress;
        const senderAddress = body.sender ?? address(body.senderPublicKey, CHAIN_ID);
        const sponsor = await this.getSponsor(senderAddress, this?.block?.getHeight());

        if(this.block) {
            return Promise.resolve([
                Operation.create(0, body.recipient, body.amount, OperationTypes.Transfer),
                Operation.create(1, senderAddress, -body.amount, OperationTypes.Transfer),
                Operation.create(2, sponsor ?? senderAddress, -body.fee, OperationTypes.Transfer)
            ]);
        } else {
            return Promise.resolve([
                Operation.createNew(0, body.recipient, body.amount, OperationTypes.Transfer),
                Operation.createNew(1, senderAddress, -body.amount, OperationTypes.Transfer),
                Operation.createNew(2, sponsor ?? senderAddress, -body.fee, OperationTypes.Transfer)
            ]);
        }

    }

    private async getLeaseTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ILeaseTransaction & WithSenderAddress;
        const senderAddress = body.sender ?? address(body.senderPublicKey, CHAIN_ID);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());

        return Promise.resolve([
            Operation.create(0, body.recipient, body.amount, OperationTypes.Lease),
            Operation.create(1, senderAddress, -body.amount, OperationTypes.Lease),
            Operation.create(2, sponsor ?? senderAddress, -body.fee, OperationTypes.Lease)
        ]);
    }

    private async getCancelLeaseTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ICancelLeaseTransaction & WithSenderAddress;
        const senderAddress = body.sender ?? address(body.senderPublicKey, CHAIN_ID);
        const leaseTransaction = await apiCall(`${API_BASE}/transactions/info/${body.leaseId}`) as ILeaseTransaction ;
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());

        return Promise.resolve([
            Operation.create(0, senderAddress, leaseTransaction.amount, OperationTypes.CancelLease),
            Operation.create(1, leaseTransaction.recipient, -leaseTransaction.amount, OperationTypes.CancelLease),
            Operation.create(2, sponsor ?? senderAddress, -body.fee, OperationTypes.CancelLease)
        ]);
    }

    private async getMassTransferOperations(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IMassTransferTransaction & WithSenderAddress;
        let operationId = 0;
        const resultArray: Array<IOperation> = [];
        body.transfers.forEach((transfer) => {
            resultArray.push(
                Operation.create(operationId++, transfer.recipient, transfer.amount, OperationTypes.MassTransfer),
                Operation.create(operationId++, body.sender, -transfer.amount, OperationTypes.MassTransfer)
            )
        });
        const sponsor = await this.getSponsor(body.sender, body.height);
        const massTransferFee = Operation.create(operationId++, sponsor ?? body.sender, -body.fee, OperationTypes.MassTransfer);
        resultArray.push(massTransferFee);

        return Promise.resolve(resultArray);
    }

    private async getDataTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IDataTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());
        return Promise.resolve([
            Operation.create(0, sponsor ?? senderAddress, -body.fee, OperationTypes.Data)
        ]);
    }

    private async getSetScriptTransaction(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ISetScriptTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());
        return Promise.resolve([
            Operation.create(0, sponsor ?? senderAddress, -body.fee, OperationTypes.SetScript)
        ]);
    }

    private async getAnchorTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IAnchorTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());

        return Promise.resolve([
            Operation.create(0, sponsor ?? senderAddress, -body.fee, OperationTypes.Anchor)
        ]);
    }

    private async getAssociationTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IAssociationTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());

        return Promise.resolve([
            Operation.create(0, sponsor ?? senderAddress, -body.fee, OperationTypes.Association)
        ]);
    }

    private async getRevokeAssociationTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & IRevokeAssociationTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());

        return Promise.resolve([
            Operation.create(0, sponsor ?? senderAddress, -body.fee, OperationTypes.RevokeAssociation)
        ]);
    }

    private async getSponsorTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ISponsorTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);

        const newSponsor = new Sponsorship(body.recipient, senderAddress, this.block.getHeight());
        let sponsors = await storage.getItem('sponsors') as Sponsorship[] || [];
        sponsors = [...sponsors, newSponsor];
        await storage.setItem('sponsors', sponsors);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());

        return Promise.resolve([
            Operation.create(0, sponsor ?? senderAddress, -body.fee, OperationTypes.Sponsor)
        ]);
    }

    private async getCancelSponsorTransactions(): Promise<Array<IOperation>> {
        const body = this.body as IApiTransaction & ICancelSponsorTransaction & WithSenderAddress;
        const senderAddress = body.sender ? body.sender : address(body.senderPublicKey, CHAIN_ID);
        let sponsors = await storage.getItem('sponsors') as Sponsorship[];
        sponsors = sponsors.filter((sponsor: Sponsorship) => sponsor.sponsor !== senderAddress && sponsor.recipient !== body.recipient);
        await storage.removeItem('sponsors');
        await storage.setItem('sponsors', sponsors);
        const sponsor = await this.getSponsor(senderAddress, this.block.getHeight());

        return Promise.resolve([
            Operation.create(0, sponsor ?? senderAddress, -body.fee, OperationTypes.CancelSponsor)
        ]);
    }

    private async getRewardWithFeesOperations(): Promise<Array<IOperation>> {
        const blockGenerator = await this.block.getGenerator();
        const prevBlock = await new Block(this.block.getHeight() - 1).fetch();
        const burned = this.block.getHeight() >= BURN_ACTIVATION_HEIGHT ? 10000000 : 0;
        const prevFee = (prevBlock.getBody().fee - (prevBlock.getBody().transactionCount * burned)) * 0.6;
        const curFee = (this.block.getBody().fee - (this.block.getBody().transactionCount * burned)) * 0.4;

        if(this.block.getHeight() === 1) {
            return Promise.resolve([
                Operation.create(0, blockGenerator, curFee, OperationTypes.Reward)
            ]);
        }
        return Promise.resolve([
            Operation.create(0, blockGenerator, prevFee, OperationTypes.Reward),
            Operation.create(1, blockGenerator, curFee, OperationTypes.Reward)
        ]);
    }

    private async getSponsor(address: string, height: number): Promise<string> {
        const sponsors = await storage.getItem('sponsors') as Sponsorship[] || [];
        return sponsors.find((sponsor: Sponsorship)  => sponsor.recipient === address && height >= sponsor.height)?.sponsor;
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
