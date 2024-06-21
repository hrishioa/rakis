// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import the AI Contract interface
interface IAIContract {
    struct RequestParams {
        string prompt;
        string model;
        uint256 maxOutputTokens;
        uint256 maxResponseTimeoutMs;
        uint256 returnReserve;
        string callbackFunc;
        address callbackContract;
    }

    function requestAI(RequestParams memory params) external payable;
    function getSupportedModels(
        uint256 limit
    )
        external
        view
        returns (string[] memory, uint256[] memory, uint256[] memory);
}

contract UserContract {
    // AI Contract address
    address public aiContractAddress;

    // Last processed AI output
    string public lastProcessedOutput;

    // Last error message
    string public lastErrorMessage;

    // Constructor to set the AI Contract address
    constructor(address _aiContractAddress) {
        aiContractAddress = _aiContractAddress;
    }

    // Function to request AI inference from the AI Contract
    function requestAI(
        string memory prompt,
        string memory model
    ) external payable {
        uint256 maxOutputTokens = 100; // Adjust this value based on your requirements
        uint256 maxResponseTimeoutMs = 30000; // Adjust this value based on your requirements
        uint256 returnReserve = 0.001 ether; // Adjust this value based on your requirements
        string memory callbackFunc = "processAIOutput";

        IAIContract.RequestParams memory params = IAIContract.RequestParams(
            prompt,
            model,
            maxOutputTokens,
            maxResponseTimeoutMs,
            returnReserve,
            callbackFunc,
            address(this)
        );

        IAIContract(aiContractAddress).requestAI{value: msg.value}(params);
    }

    receive() external payable {
        // Receive Ether function (EIP-1559)
        // This function will be called when Ether is sent to the contract without data
    }

    // Callback function to process the AI output
    function processAIOutput(
        uint256 invocationId,
        string memory response
    ) external {
        require(
            msg.sender == aiContractAddress,
            "Only the AI Contract can call this function"
        );
        lastProcessedOutput = response;
    }

    // Callback function to handle AI errors
    function processAIError(
        uint256 invocationId,
        string memory errorMessage,
        uint256 usedFunds
    ) external {
        require(
            msg.sender == aiContractAddress,
            "Only the AI Contract can call this function"
        );
        lastErrorMessage = errorMessage;
    }

    // Function to get the last processed AI output
    function getLastProcessedOutput() external view returns (string memory) {
        return lastProcessedOutput;
    }

    // Function to get the last error message
    function getLastErrorMessage() external view returns (string memory) {
        return lastErrorMessage;
    }

    // Function to get the list of supported models from the AI Contract
    function getSupportedModels(
        uint256 limit
    )
        external
        view
        returns (string[] memory, uint256[] memory, uint256[] memory)
    {
        return IAIContract(aiContractAddress).getSupportedModels(limit);
    }

    // Function to allow the contract owner to withdraw funds
    function withdraw() external {
        payable(owner()).transfer(address(this).balance);
    }

    // Function to get the owner of the contract
    function owner() public view returns (address) {
        return address(this);
    }
}
