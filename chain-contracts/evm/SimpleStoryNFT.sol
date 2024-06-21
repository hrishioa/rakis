// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AIContract.sol";

import "hardhat/console.sol";

contract SimpleStoryNFTContract is ERC721, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;

    uint256 public mintPrice;
    AIContract public aiContract;

    mapping(uint256 => string) private _tokenIdToStory;
    mapping(uint256 => uint256) private _requestIdToTokenId;

    string private constant MINTING_TEXT = "Minting with AI...";

    event NFTMinted(
        address indexed owner,
        uint256 indexed tokenId,
        string word1,
        string word2
    );
    event MintPriceUpdated(uint256 newPrice);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event AIRequestFailed(
        uint256 indexed requestId,
        uint256 indexed tokenId,
        uint256 usedFunds,
        string errorMessage
    );

    constructor(
        address _aiContractAddress,
        uint256 _mintPrice
    ) ERC721("AIGeneratedNFT", "AINFT") Ownable(msg.sender) {
        aiContract = AIContract(_aiContractAddress);
        mintPrice = _mintPrice;
    }

    function mint(
        string memory word1,
        string memory word2
    ) public payable nonReentrant {
        require(msg.value == mintPrice, "Incorrect payment amount");
        require(
            bytes(word1).length > 0 && bytes(word1).length <= 50,
            "Word1 must be between 1 and 50 characters"
        );
        require(
            bytes(word2).length > 0 && bytes(word2).length <= 50,
            "Word2 must be between 1 and 50 characters"
        );

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;
        _safeMint(msg.sender, tokenId);

        _tokenIdToStory[tokenId] = MINTING_TEXT;

        string memory prompt = string(
            abi.encodePacked(
                "Generate a short story based on the words: ",
                word1,
                " ",
                word2
            )
        );
        _requestAICompletion(prompt);

        emit NFTMinted(msg.sender, tokenId, word1, word2);
    }

    function getStory(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _tokenIdToStory[tokenId];
    }

    function _requestAICompletion(
        string memory prompt
    ) private returns (uint256) {
        AIContract.RequestParams memory params = AIContract.RequestParams({
            prompt: prompt,
            model: "gpt-3.5-turbo",
            maxOutputTokens: 200,
            maxResponseTimeoutMs: 30000,
            returnReserve: 0.001 ether,
            callbackFunc: "processAIOutput",
            callbackContract: address(this)
        });

        uint256 requestId = aiContract.requestAI{value: mintPrice}(params);

        console.log("Request id is ", requestId);
        console.log("Token id is ", _tokenIdCounter - 1);

        _requestIdToTokenId[requestId] = _tokenIdCounter - 1;
        return requestId;
    }

    function processAIOutput(uint256 requestId, string memory story) public {
        console.log("Processing AI output", requestId, story);

        require(
            msg.sender == address(aiContract),
            "Only the AI contract can call this function"
        );
        // TODO: This doesn't work because tokenId can be zero - we need to find
        // a new way to check if it exists, or maybe we can just mint the first one somehow?
        // require(_requestIdToTokenId[requestId] != 0, "Invalid request ID");

        uint256 tokenId = _requestIdToTokenId[requestId];
        _tokenIdToStory[tokenId] = story;
        delete _requestIdToTokenId[requestId];
    }

    function processAIError(
        uint256 requestId,
        string memory errorMessage,
        uint256 usedFunds
    ) public {
        console.log(
            "Processing AI Error for ",
            requestId,
            " with usedFunds ",
            usedFunds
        );

        console.log(
            "Is this the AI Contract calling us? ",
            msg.sender == address(aiContract)
        );

        require(
            msg.sender == address(aiContract),
            "Only the AI contract can call this function"
        );

        // TODO: This has the same problem as before - if this is the first token, we have a problem
        // require(_requestIdToTokenId[requestId] != 0, "Invalid request ID");

        console.log("Everything looks right");

        uint256 tokenId = _requestIdToTokenId[requestId];
        delete _requestIdToTokenId[requestId];

        uint256 refundAmount = mintPrice - usedFunds;

        console.log("Refund amount is ", refundAmount);

        if (refundAmount > 0) {
            console.log("Refunded ", refundAmount, " to ", ownerOf(tokenId));

            payable(ownerOf(tokenId)).transfer(refundAmount);
        }

        console.log("Burning");
        _burn(tokenId);
        emit AIRequestFailed(requestId, tokenId, usedFunds, errorMessage);
    }

    function setMintPrice(uint256 _mintPrice) public onlyOwner {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(_mintPrice);
    }

    function withdraw() public onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
        emit FundsWithdrawn(owner(), amount);
    }
}
