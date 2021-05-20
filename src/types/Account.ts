import {API_BASE} from "../secrets/secrets";
import {Block, IBlock} from "./Block";
import {LTOCurrencyDetails} from "./LTOCurrencyDetails";
import {apiCall} from "../utils/utils";
import {ErrorCodes, ErrorResponse} from "ErrorResponse";

export interface IAccountIdentifier {
    address: string
}


export class Account {

    private readonly address: string;

    constructor(address: string) {
        this.address = address;
    }

    getAddress(): string {
        return this.address;
    }

    async getBalanceAtBlock(block?: Block): Promise<{ height: number; balance: number }> {
        const effectiveBalance = await apiCall(`${API_BASE}/addresses/effectiveBalance/${this.address}`);
        const lastBlock = await apiCall(`${API_BASE}/blocks/last`);

        return {
            height: block ? block.getHeight() : lastBlock.height,
            balance: effectiveBalance.balance
        };
    }

    async getBalanceData(block?: Block) {
        const balanceAtBlock = await this.getBalanceAtBlock(block);
        const lastFoundBlock = await apiCall(`${API_BASE}/blocks/at/${balanceAtBlock.height}`) as IBlock;
        const blockDetails = {
            index: lastFoundBlock.height,
            hash: lastFoundBlock.signature
        };
        return {
            block_identifier: blockDetails,
            balances: [
                {
                    value: balanceAtBlock.balance.toString(),
                    currency: {
                        symbol: LTOCurrencyDetails.symbol,
                        decimals: LTOCurrencyDetails.decimals,
                        metadata: {
                        }
                    },
                    metadata: {}
                }
            ],
            // TODO: add coins identifier
            // "coins": [],
            metadata: {
                // "sequence_number": 23
            }
        }
    }

    static createFromIdentifier(accountIdentifier: IAccountIdentifier) {
        return new this(accountIdentifier.address);
    }

    getIdentifier(): IAccountIdentifier {
        return {
            address: this.address
        }
    }
}
