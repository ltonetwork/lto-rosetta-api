import {ITransaction, WithId} from '@lto-network/lto-transactions';
import {Block} from "./Block";
import {API_BASE, REFERENCE_API_BASE} from "../secrets/secrets";
import {ErrorCodes, ErrorResponse} from "./ErrorResponse";
import {apiCall} from "../utils/utils";


export interface INetworkIdentifier {
    blockchain: string,
    network: NetworkTypesEnum,
    metadata?: any
}

export enum NetworkTypesEnum {
    Mainnet = 'mainnet',
    Testnet = 'testnet'
}

export class Network {

    private readonly network: NetworkTypesEnum;

    private static Blockchain = 'LTO Network';
    public static SupportedTypes = [NetworkTypesEnum.Mainnet, NetworkTypesEnum.Testnet];
    public static ApiBase = API_BASE;
    public static ReferenceApiBase = REFERENCE_API_BASE;

    constructor(network: NetworkTypesEnum) {
        this.network = network;

    }

    static getSupportedChains(): Array<INetworkIdentifier> {
        return Network.SupportedTypes.map(chain => new Network(chain).getIdentifier())
    }

    static typeIsSupported(networkType: NetworkTypesEnum): boolean {
        return Network.SupportedTypes
            .indexOf(networkType) !== -1;
    }

    static createFromIdentifier(identifier: INetworkIdentifier): Network {
        if (identifier.blockchain.toLowerCase() !== Network.Blockchain.toLowerCase())
            throw new ErrorResponse(ErrorCodes.UnknownBlockchainIdentifier, `Invalid blockchain identifier`);
        if (!Network.typeIsSupported(identifier.network))
            throw new ErrorResponse(ErrorCodes.UnknownNetworkType, `Invalid network type, these are supported: ${Network.SupportedTypes.join(', ')}`);
        return new this(identifier.network);
    }

    getIdentifier(): INetworkIdentifier {
        return {
            blockchain: Network.Blockchain,
            network: this.network
        }
    }

    getApiBase(): string {
        return Network.ApiBase;
    }

    getReferenceApiBase(): string {
        return Network.ReferenceApiBase;
    }

    async getCurrentHeight(): Promise<number> {
        const blockHeight = await apiCall(`${API_BASE}/blocks/height`);
        return blockHeight.height;
    }

    async getReferenceNodeCurrentHeight(): Promise<number> {
        const blockHeight = await apiCall(`${REFERENCE_API_BASE}/blocks/height`);
        return blockHeight.height;
    }

    async getCurrentBlock(): Promise<Block> {
        const currentHeight = await this.getCurrentHeight();
        const currentBlock = new Block(currentHeight);
        await currentBlock.fetch();
        return currentBlock;
    }

    async getNodeVersion(): Promise<string> {
        const nodeVersion = await apiCall(`${API_BASE}/node/version`);
        return nodeVersion.version;
    }

    async getMempoolTxs(): Promise<Array<ITransaction & WithId>> {
        return await apiCall(`${API_BASE}/transactions/unconfirmed`) as Array<ITransaction & WithId>;
    }

    async getMempoolTxHashes(): Promise<Array<{ hash: string }>> {
        const txs = await this.getMempoolTxs();
        return txs.map(tx => {
            return {hash: tx.id}
        })
    }
}
