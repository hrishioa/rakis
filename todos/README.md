# Project TODOs

## components/dashboard/inferences.tsx

- [ ] [Allow clicking each inference to show the full inference data as a datalist (all commit data, etc etc)](https://github.com/hrishioa/rakis/blob/master/src/components/dashboard/inferences.tsx#L421)

## components/dashboard/packets.tsx

- [ ] [Really dumb brute force way to filter, I know I know](https://github.com/hrishioa/rakis/blob/master/src/components/dashboard/packets.tsx#L273)

## hooks/useTheDomain.ts

- [ ] [Need to type this function later so its easier to propdrill](https://github.com/hrishioa/rakis/blob/master/src/hooks/useTheDomain.ts#L66)

## rakis-core/synthient-chain/consensus/consensus-core.ts

- [ ] [Change this to a worker in case it becomes // Computationally expensive](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/consensus/consensus-core.ts#L18)
- [ ] [Investigate if it's only one particular P2P // network that does this](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/consensus/consensus-core.ts#L106)
- [ ] [Super easy optimization here is just to only compute one side of the diagonal in this matrix, skipping for time](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/consensus/consensus-core.ts#L175)

## rakis-core/synthient-chain/db/entities.ts

- [ ] [Move this elsewhere](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/entities.ts#L17)
- [ ] [^ Need to figure out how to get types across from wagmi here](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/entities.ts#L30)

## rakis-core/synthient-chain/db/inferencedb.ts

- [ ] [This might be really quite expensive as the db gets larger, remember to denormalize when some day you have time](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/inferencedb.ts#L90)
- [ ] [Use a different source of randomness here, probably the txhash](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/inferencedb.ts#L531)
- [ ] [See if we can't make this an array, or just switch to // individual objects like in packetdb](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/inferencedb.ts#L581)

## rakis-core/synthient-chain/db/packet-types.ts

- [ ] [These might be retired at some point, the intent here is just to test // faster without costs of doing things on-chain](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/packet-types.ts#L115)

## rakis-core/synthient-chain/db/packetdb.ts

- [ ] [Consider keeping createdAt time as a separate date field on the outside, as a Date object in the db for better indexing](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/packetdb.ts#L37)
- [ ] [In the future we can add some actual verification and propagation between nodes in case we want to implement that _above_ the p2p layer, for now you shouldn't really be getting them from someone else](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/packetdb.ts#L104)
- [ ] [These are magic constants for now, move them to settings later](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/packetdb.ts#L344)

## rakis-core/synthient-chain/db/peerdb.ts

- [ ] [I know this is a side-effect but I don't have the time to actually work through the memory cost of making this copy](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/peerdb.ts#L36)
- [ ] [This is way too complicated I know but we're just // deduping the chainIds array in the end](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/peerdb.ts#L188)
- [ ] [Maybe we should do a more comprehensive merge to keep as many chainidentities as we can?](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/peerdb.ts#L245)

## rakis-core/synthient-chain/db/quorumdb.ts

- [ ] [IMPORTANT Validate the actual reveal before adding it to our quorum // by double checking the embeddings and hash](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/db/quorumdb.ts#L192)

## rakis-core/synthient-chain/llm/llm-engine.ts

- [ ] [Move this into indexedDB](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/llm/llm-engine.ts#L43)
- [ ] [This could use more work streamlining, just tired tonight](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/llm/llm-engine.ts#L357)
- [ ] [Process errors](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/llm/llm-engine.ts#L558)
- [ ] [Process errors](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/llm/llm-engine.ts#L583)

## rakis-core/synthient-chain/p2p-networks/pewpewdb.ts

- [ ] [Properly type this for both sides](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/p2p-networks/pewpewdb.ts#L64)
- [ ] [Long term we want to shuttle the errors out so replace the console errors with a call to the error handler](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/p2p-networks/pewpewdb.ts#L121)

## rakis-core/synthient-chain/thedomain/connectors.ts

- [ ] [This should be depreated later so we don't have a cycle in our // data flow](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/connectors.ts#L22)
- [ ] [IMPORTANT Do we save other peoples consensus packets? Maybe if there's not a collision, or save all for posterity?](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/connectors.ts#L159)

## rakis-core/synthient-chain/thedomain/settings.ts

- [ ] [This is being sent out but not really enforced](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/settings.ts#L203)

## rakis-core/synthient-chain/thedomain/thedomain.ts

- [ ] [Move all the listeners below into proper named functions and then add unloading them to the shutdown listeners](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/thedomain.ts#L96)
- [ ] [We want the timeouts in all the dbs to restart on restart, in case it wasn't graceful and we were in the middle of something](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/thedomain.ts#L226)
- [ ] [For someone else to test](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/thedomain.ts#L423)
- [ ] [Log an error?](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/thedomain.ts#L513)
- [ ] [We probably want things to emit events we can save to the logs](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/thedomain/thedomain.ts#L721)

## rakis-core/synthient-chain/utils/simple-crypto.ts

- [ ] [only works for external accounts, which is fine for us // and to actually do account abstraction you need to drill in // the actual wallet client which is a massive pain](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/utils/simple-crypto.ts#L9)
- [ ] [Verify that this is actually how to do it :D](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/utils/simple-crypto.ts#L52)
- [ ] [replace this with the sha512, but I'm a little worried about rewriting the // crypto right now](https://github.com/hrishioa/rakis/blob/master/src/rakis-core/synthient-chain/utils/simple-crypto.ts#L86)
