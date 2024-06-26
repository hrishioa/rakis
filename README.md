<h1 align="center">
  <br>
  <a href="https://github.com/hrishioa/wishful-search"><img src="https://github.com/hrishioa/rakis/assets/973967/5abc4815-fe73-49d6-ba71-42a311b97249" alt="Rakis" width="100"></a>
  <br>
  Rakis
  <br>
</h1>

<h3 align="center">A decentralized verifiable AI network in the browser</h3>

<div align="center">

  [![Twitter Follow](https://img.shields.io/twitter/follow/hrishi?style=social)](https://twitter.com/hrishioa)  [![License](https://img.shields.io/badge/license-CC--BY--NC--SA--4.0-blue.svg)]([https://opensource.org/licenses/Apache-2.0](https://creativecommons.org/licenses/by-nc/4.0/deed.en))

</div>

<p align="center">
  <a href="https://rakis.ai" target="_blank">Run a node</a> •
  <a href="https://olickel.com/introducing-rakis">The story</a> •
  <a href="https://rakis-docs.vercel.app" target="_blank">Detailed Docs</a> •
  <a href="#novel-contributions">Novel Contributions</a> •
  <a href="#ask-live-questions">Ask live questions</a>
</p>

<div align="center">

![output2](https://github.com/hrishioa/rakis/assets/973967/87e7deb6-d4f3-4805-8671-d20753b183e4)

</div>

Rakis is a permissionless inference network where nodes can accept AI inference requests, run local models, verify each other's results and arrive at consensus - all in the browser. There are no servers. You can read about [the origins here](https://olickel.com/introducing-rakis).

*This repo is also the work of one overworked dev, and meant to be for educational purposes. Use at your own risk!*

# How to use

Go to [rakis.ai](https://rakis.ai) to run your own node and be part of the network. Or you can use the compiled version [hosted on Huggingface](https://huggingface.co/spaces/hrishioa/rakis).

# Novel contributions

* **Open-source from day one**
  - There is no hidden code, or 'coming soon'. Every line of code executed on the network is here, and all the blockchain contracts that will serve as the eventual interface to the Rakis network [are here](https://github.com/hrishioa/rakis/tree/master/chain-contracts/evm). [Lumentis](https://github.com/hrishioa/lumentis) and [Julian](https://twitter.com/Degen_Julian) have helped us to put together detailed documentation [which you can find here](https://rakis-docs.vercel.app).

* **Functional from day one**
  -  All of the fundamental primitives needed for a decentralized network - from inferencing, embedding, consensus mechanisms to the peer-to-peer type specs, is here. To what extent it will remain so under load, we don't know - and it's what we hope to find out with the stability test.

* **Multi-model, multi-chain, multi-network**
  - The internals of the network have been built to be redundantly connected to multiple blockchains, chain identities, peer-to-peer networks (four are currently operational for redundancy), AI models, embedding models, platforms, and so on. Doing this has benefits for ML counterengineering work, and prevents us from locking down the implementation too tightly to any one format.

* **Browser-first**
  - Rakis is a celebration of the browser as a platform. We hope that this has a democratizing effect due to the ease of entry. [WebGPU](https://www.w3.org/TR/webgpu/) today remains one of our best hope for running AI models in any platform, and client systems (like the device you're reading this on) have a lot less variability in compute than servers.
 
* **Permissionless**
  - Anyone can be a part of the Rakis network. Anyone with a browser can send inference requests and participate in consensus, and anyone with a WebGPU-enabled browser (that tends to be Chrome for now) can process inferences and generate tokens.
 
* **Embedding-based consensus**
  - Rakis implements a novel embedding-based consensus mechanism (with some paths to others) that aims to get to verifiable inference before ZKML or TPMs. Embedding clusters are used to separate valid results from invalid ones.

# Run using the repo

This project was created with a NextJS starter template. Simply clone the repo, [install bun](https://bun.sh/docs/installation), and run:

```bash
bun dev
```

to start the project.

# Ask live questions

Download [help/core-code-for-LLMS.txt](https://github.com/hrishioa/rakis/blob/master/help/core-code-for-LLMs.txt) and throw it into ChatGPT or Claude (preferably Claude) and ask your questions. Please post about the answers, so we can add them here, or fact-check!

You can run `bun run extractForLLM` to generate a new file if you've changed the code.

# How can I help?

Generated TODOs (from my comments) are in the [TODOs folder](https://github.com/hrishioa/rakis/tree/master/todos). Feel free to pick any of them up!

There are two big TODOs at the project level:

1. Post-stability-test, we intend to further bulletproof the contracts that will be deployed on-chain, and work with ecosystem partners to deploy functional smart-contract inference on-chain.
2. Connecting centralized models (like Claude and GPT) is now possible, but transaction replay will not be possible. Help us add this so we can see what happens!
