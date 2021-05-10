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
        const balancesHistory = await apiCall(`${API_BASE}/addresses/balance/history/${this.address}`)  as Array<{ height: number, balance: number }>;
        const oldestBlock = balancesHistory[balancesHistory.length - 1].height;

        if(block) {
            // if (oldestBlock > block.getHeight()) {
            //     throw new ErrorResponse(ErrorCodes.BalanceAtOldBlock, `Can't fetch balance for an old block, the oldest possible is ${oldestBlock}`)
            // }
            return balancesHistory.reduce((a, b) => {
                let aDiff = Math.abs(a.height - block.getHeight());
                let bDiff = Math.abs(b.height - block.getHeight());

                if (aDiff == bDiff) {
                    return a > b ? a : b;
                } else {
                    return bDiff < aDiff ? b : a;
                }
            });
        }

        return balancesHistory.reverse().pop();
        // const oldestBlock = balancesHistory[balancesHistory.length - 1].height;
        // const balanceAtBlock = balancesHistory.find((element) => element.height === block.getHeight());
        // if (balanceAtBlock === undefined) {
        //     throw new ErrorResponse(ErrorCodes.BalanceAtOldBlock, `Can't fetch balance for an old block, the oldest possible is ${oldestBlock}`)
        // }
        // return balanceAtBlock.balance;
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
