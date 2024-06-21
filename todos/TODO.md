# Project TODOs

## hooks/useTheDomain.ts

- [ ] Need to type this function later so its easier to propdrill

## rakis-core/synthient-chain/consensus/consensus-core.ts

- [ ] Change this to a worker in case it becomes // Computationally expensive
- [ ] Investigate if it's only one particular P2P // network that does this
- [ ] Super easy optimization here is just to only compute one side of the diagonal in this matrix, skipping for time

## rakis-core/synthient-chain/db/entities.ts

- [ ] Move this elsewhere
- [ ] ^ Need to figure out how to get types across from wagmi here

## rakis-core/synthient-chain/db/inferencedb.ts

- [ ] This might be really quite expensive as the db gets larger, remember to denormalize when some day you have time
- [ ] Use a different source of randomness here, probably the txhash
- [ ] See if we can't make this an array, or just switch to // individual objects like in packetdb

## rakis-core/synthient-chain/db/packet-types.ts

- [ ] These might be retired at some point, the intent here is just to test // faster without costs of doing things on-chain

## rakis-core/synthient-chain/db/packetdb.ts

- [ ] Consider keeping createdAt time as a separate date field on the outside, as a Date object in the db for better indexing
- [ ] In the future we can add some actual verification and propagation between nodes in case we want to implement that *above* the p2p layer, for now you shouldn't really be getting them from someone else
- [ ] These are magic constants for now, move them to settings later

## rakis-core/synthient-chain/db/peerdb.ts

- [ ] I know this is a side-effect but I don't have the time to actually work through the memory cost of making this copy
- [ ] This is way too complicated I know but we're just // deduping the chainIds array in the end
- [ ] Maybe we should do a more comprehensive merge to keep as many chainidentities as we can?

## rakis-core/synthient-chain/db/quorumdb.ts

- [ ] IMPORTANT Validate the actual reveal before adding it to our quorum // by double checking the embeddings and hash

## rakis-core/synthient-chain/llm/llm-engine.ts

- [ ] Move this into indexedDB
- [ ] This could use more work streamlining, just tired tonight
- [ ] Process errors
- [ ] Process errors

## rakis-core/synthient-chain/p2p-networks/pewpewdb.ts

- [ ] Properly type this for both sides
- [ ] Long term we want to shuttle the errors out so replace the console errors with a call to the error handler

## rakis-core/synthient-chain/thedomain/connectors.ts

- [ ] This should be depreated later so we don't have a cycle in our // data flow
- [ ] IMPORTANT Do we save other peoples consensus packets? Maybe if there's not a collision, or save all for posterity?

## rakis-core/synthient-chain/thedomain/settings.ts

- [ ] This is being sent out but not really enforced

## rakis-core/synthient-chain/thedomain/thedomain.ts

- [ ] Move all the listeners below into proper named functions and then add unloading them to the shutdown listeners
- [ ] We want the timeouts in all the dbs to restart on restart, in case it wasn't graceful and we were in the middle of something
- [ ] For someone else to test
- [ ] Log an error?
- [ ] We probably want things to emit events we can save to the logs

## rakis-core/synthient-chain/utils/simple-crypto.ts

- [ ] only works for external accounts, which is fine for us // and to actually do account abstraction you need to drill in // the actual wallet client which is a massive pain
- [ ] Verify that this is actually how to do it :D
- [ ] replace this with the sha512, but I'm a little worried about rewriting the // crypto right now

