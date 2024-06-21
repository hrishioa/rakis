// SPDX-License-Identifier: BUSL 1.1
pragma solidity ^0.8.19;

// Struct to hold AI request details
struct Request {
    address caller;
    string callbackFunc;
    string prompt;
    uint256 invocationId;
    uint256 allocatedFunds;
    uint256 maxOutputTokens;
    uint256 maxResponseTimeoutMs;
    uint256 returnReserve;
    address callbackContract;
    string model;
}

// Interface for the callback function in the User Contract
interface IUserContract {
    function processAIOutput(
        uint256 invocationId,
        string memory response
    ) external;
    function processAIError(
        uint256 invocationId,
        string memory errorMessage,
        uint256 usedFunds
    ) external;
    function getLastProcessedOutput() external view returns (string memory);
}

contract AIContract {
    bool private locked = false;

    // Event emitted when a new AI request is made
    event NewRequest(
        address indexed caller,
        string callbackFunc,
        string prompt,
        uint256 indexed invocationId,
        uint256 allocatedFunds,
        string model,
        uint256 maxOutputTokens
    );

    // Event emitted when a request fails
    event RequestReportFailed(
        uint256 indexed invocationId,
        string errorMessage,
        uint256 usedFunds,
        string failReason
    );

    // Mapping to store the cost per token for each AI model
    mapping(string => uint256) public modelCostPerToken;

    // Mapping to store the tokens per byte for each AI model
    mapping(string => uint256) public modelTokensPerByte;

    // Array to store the names of supported models
    string[] public supportedModels;

    // Mapping to store the request details using invocation ID as the key
    mapping(uint256 => Request) public requests;

    // Counter for generating unique invocation IDs
    uint256 public invocationCounter;

    // Address of the authorized AI Runner
    address public aiRunner;

    // Owner of the contract
    address public owner;

    // Fee percentage (in basis points) for each request
    uint256 public feePercentage;

    // Total fees collected
    uint256 public totalFeesCollected;

    // Constructor to set the AI Runner address, model costs, owner, and fee percentage
    constructor(address _aiRunner, uint256 _feePercentage) {
        aiRunner = _aiRunner;
        supportedModels.push("gpt-3.5-turbo");
        supportedModels.push("gpt-4-turbo-preview");
        modelCostPerToken["gpt-3.5-turbo"] = 1e15;
        modelCostPerToken["gpt-4-turbo-preview"] = 2e15;
        modelTokensPerByte["gpt-3.5-turbo"] = 2;
        modelTokensPerByte["gpt-4-turbo-preview"] = 1;
        owner = msg.sender;
        feePercentage = _feePercentage;
        totalFeesCollected = 0;
    }

    // Function to estimate token cost for a given prompt, model, and max output tokens
    function estimateTokenCost(
        string memory prompt,
        string memory model,
        uint256 maxOutputTokens
    ) public view returns (uint256) {
        uint256 promptTokens = bytes(prompt).length / modelTokensPerByte[model];
        uint256 totalTokens = promptTokens + maxOutputTokens;
        return (totalTokens * modelCostPerToken[model]);
    }

    struct RequestParams {
        string prompt;
        string model;
        uint256 maxOutputTokens;
        uint256 maxResponseTimeoutMs;
        uint256 returnReserve;
        string callbackFunc;
        address callbackContract;
    }

    // TODO: To consider if this needs to be memory or storage or calldata, nothing to action yet
    function requestAI(
        RequestParams memory params
    ) external payable returns (uint256) {
        require(modelCostPerToken[params.model] > 0, "Unsupported AI model");

        uint256 estimatedCost = estimateTokenCost(
            params.prompt,
            params.model,
            params.maxOutputTokens
        );
        uint256 fee = (estimatedCost * feePercentage) / 10000;

        uint256 totalCost = estimatedCost + params.returnReserve + fee;

        require(
            msg.value >= totalCost,
            "Insufficient funds provided for AI inference"
        );

        invocationCounter++;
        requests[invocationCounter] = Request(
            msg.sender,
            params.callbackFunc,
            params.prompt,
            invocationCounter,
            msg.value,
            params.maxOutputTokens,
            params.maxResponseTimeoutMs,
            params.returnReserve,
            params.callbackContract,
            params.model
        );

        emit NewRequest(
            msg.sender,
            params.callbackFunc,
            params.prompt,
            invocationCounter,
            msg.value,
            params.model,
            params.maxOutputTokens
        );

        return invocationCounter;
    }

    // Function for the AI Runner to provide the model's response

    // TODO: We might want the ability to set a gas price here to make sure the external call can go through, some way where this can be adjusted by the AI Runner

    // We don't really need reentrancy protection in this version due to access controls

    function fulfillRequest(
        uint256 invocationId,
        string memory response,
        uint256 actualCost
    ) external onlyOwnerOrRunner nonReentrant {
        Request storage request = requests[invocationId];
        require(request.caller != address(0), "Invalid invocation ID");

        uint256 fee = (actualCost * feePercentage) / 10000;
        uint256 remainingBalance = request.allocatedFunds - actualCost - fee;

        uint256 executionBudget = remainingBalance > request.returnReserve
            ? request.returnReserve
            : remainingBalance;

        uint256 gasLimit = executionBudget / tx.gasprice;

        gasLimit = block.gaslimit < gasLimit ? block.gaslimit : gasLimit;

        if (request.callbackContract != address(0)) {
            // TODO: We might want to make sure the call doesn't fail and revert our execution

            IUserContract(request.callbackContract).processAIOutput{
                gas: gasLimit
            }(invocationId, response);

            if (remainingBalance - executionBudget > 0) {
                address payable callbackContract = payable(
                    request.callbackContract
                );

                (bool sent, ) = callbackContract.call{
                    value: remainingBalance - executionBudget
                }("");
                if (sent) {} else {
                    // TODO: Probably emit a failed event here
                }
            }
        }

        totalFeesCollected += fee;
        delete requests[invocationId];
    }

    // Function to handle failed or timed-out requests
    function handleFailedRequest(
        uint256 invocationId,
        string memory errorMessage,
        uint256 usedFunds
    ) external onlyOwnerOrRunner nonReentrant {
        Request storage request = requests[invocationId];
        require(request.caller != address(0), "Invalid invocation ID");

        uint256 fee = (usedFunds * feePercentage) / 10000;
        uint256 remainingBalance = request.allocatedFunds - usedFunds - fee;

        uint256 executionBudget = remainingBalance > request.returnReserve
            ? request.returnReserve
            : remainingBalance;

        uint256 gasLimit = executionBudget / tx.gasprice;

        gasLimit = block.gaslimit < gasLimit ? block.gaslimit : gasLimit;

        // TODO: This is an issue. Because the processing and the refund are separate,
        // they're a lot harder to handle on the calling contract side.
        // We'll need to find a new solution.

        if (request.callbackContract != address(0)) {
            try
                IUserContract(request.callbackContract).processAIError{
                    gas: gasLimit
                }(invocationId, errorMessage, usedFunds)
            {
                // Function exists and was called successfully
            } catch Error(string memory failReason) {
                // Function does not exist or encountered an error
                emit RequestReportFailed(
                    invocationId,
                    errorMessage,
                    usedFunds,
                    failReason
                );
            }

            if (remainingBalance - executionBudget > 0) {
                address payable callbackContract = payable(
                    request.callbackContract
                );

                (bool sent, ) = callbackContract.call{
                    value: remainingBalance - executionBudget
                }("");
            }
        }

        totalFeesCollected += fee;
        delete requests[invocationId];
    }

    // Function to update the cost per token and tokens per byte for a specific AI model
    function updateModelDetails(
        string calldata model,
        uint256 newCostPerToken,
        uint256 newTokensPerByte
    ) external onlyOwnerOrRunner {
        // Check if the model already exists
        bool modelExists = false;
        for (uint256 i = 0; i < supportedModels.length; i++) {
            if (
                keccak256(bytes(supportedModels[i])) == keccak256(bytes(model))
            ) {
                modelExists = true;
                break;
            }
        }

        // Add the model to the supportedModels array if it doesn't exist
        if (!modelExists) {
            supportedModels.push(model);
        }

        modelCostPerToken[model] = newCostPerToken;
        modelTokensPerByte[model] = newTokensPerByte;
    }

    // Function to get the list of supported models and their details
    // Function to get the list of supported models and their details
    function getSupportedModels()
        external
        view
        returns (string[] memory, uint256[] memory, uint256[] memory)
    {
        uint256[] memory costPerToken = new uint256[](supportedModels.length);
        uint256[] memory tokensPerByte = new uint256[](supportedModels.length);

        for (uint256 i = 0; i < supportedModels.length; i++) {
            string memory model = supportedModels[i];
            costPerToken[i] = modelCostPerToken[model];
            tokensPerByte[i] = modelTokensPerByte[model];
        }

        return (supportedModels, costPerToken, tokensPerByte);
    }

    // Function to allow the contract owner to withdraw funds
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    // Function to update the AI Runner address
    function updateAIRunner(address newAIRunner) external onlyOwner {
        aiRunner = newAIRunner;
    }

    // Function to update the fee percentage
    function updateFeePercentage(uint256 newFeePercentage) external onlyOwner {
        feePercentage = newFeePercentage;
    }

    // Modifier to restrict access to the contract owner
    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only the contract owner can perform this action"
        );
        _;
    }

    modifier onlyOwnerOrRunner() {
        require(
            msg.sender == owner || msg.sender == aiRunner,
            "Only the contract owner or AI Runner can perform this action"
        );
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }
}
