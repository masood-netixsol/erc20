import { lookupArchive } from "@subsquid/archive-registry";
import { EvmBatchProcessor, LogHandlerContext } from "@subsquid/evm-processor";
import { Store, TypeormDatabase } from "@subsquid/typeorm-store";
import { BigNumber } from "ethers";
import { events } from "./abi/erc20";

const database = new TypeormDatabase({ stateSchema: "erc20Status" });
const processor = new EvmBatchProcessor()
  .setBlockRange({ from: 5000000 })
  .setDataSource({
    chain: process.env.RPC_ENDPOINT || "https://rpc.ankr.com/eth",
    archive: lookupArchive("eth-mainnet"),
  })
  .addLog([], {
    filter: [[events.Transfer.topic]],
    data: {
      evmLog: {
        topics: true,
        data: true,
      },
      transaction: {
        hash: true,
        from: true,
      },
    },
  });

processor.run(database, async (ctx) => {
  const transfersData: TransferData[] = [];

  for (const block of ctx.blocks) {
    for (const item of block.items) {
      if (
        item.kind === "evmLog" &&
        item &&
        item.evmLog &&
        item.evmLog.topics &&
        item.evmLog.topics.length &&
        item.evmLog.topics.length === 3
      ) {
        const transfer = handleTransfer({
          ...ctx,
          block: block.header,
          ...item,
        });

        transfersData.push(transfer);
      }
    }
  }
  console.log("i am looking for  erc 20  token");
});

type TransferData = {
  id: string;
  from: string;
  to: string;
  value: BigNumber;
  timestamp: bigint;
  block: number;
  transactionHash: string;
};

function handleTransfer(
  ctx: LogHandlerContext<
    Store,
    { evmLog: { topics: true; data: true }; transaction: { hash: true } }
  >
): TransferData {
  const { evmLog, transaction, block } = ctx;
  const addr = evmLog.address.toLowerCase();

  const { from, to, value } = events.Transfer.decode(evmLog);

  const transfer: TransferData = {
    id: `${transaction.hash}-${addr}-${value}-${evmLog.index}`,
    value: value,
    from,
    to,
    timestamp: BigInt(block.timestamp),
    block: block.height,
    transactionHash: transaction.hash,
  };

  return transfer;
}
