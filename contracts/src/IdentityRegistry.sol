// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-721 based identity registry for AI agents on Avalanche.
 *         Each agent is represented as an NFT with a metadata URI.
 *         Registration requires a 0.1 AVAX bond as an anti-sybil measure.
 */
contract IdentityRegistry is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard, Pausable {
    uint256 private _nextAgentId;
    uint256 public registrationBond = 0.1 ether;

    /// @notice Maps owner address to their agent ID (one agent per address)
    mapping(address => uint256) private _ownerToAgentId;
    /// @notice Tracks whether an address has registered an agent
    mapping(address => bool) private _hasRegistered;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);
    event BondUpdated(uint256 oldBond, uint256 newBond);
    event BondWithdrawn(address indexed to, uint256 amount);

    constructor() ERC721("AgentProof Identity", "APID") Ownable(msg.sender) {
        _nextAgentId = 1; // Start IDs at 1
    }

    /**
     * @notice Register a new AI agent by minting an identity NFT.
     * @param agentURI IPFS or HTTPS URI pointing to agent metadata JSON
     * @return agentId The newly minted agent's token ID
     */
    function registerAgent(string calldata agentURI) external payable nonReentrant whenNotPaused returns (uint256) {
        require(msg.value >= registrationBond, "Insufficient bond");
        require(!_hasRegistered[msg.sender], "Already registered");
        require(bytes(agentURI).length > 0, "URI cannot be empty");

        uint256 agentId = _nextAgentId;
        _nextAgentId++;

        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        _ownerToAgentId[msg.sender] = agentId;
        _hasRegistered[msg.sender] = true;

        // Refund excess payment
        if (msg.value > registrationBond) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - registrationBond}("");
            require(success, "Refund failed");
        }

        emit AgentRegistered(agentId, msg.sender, agentURI);
        return agentId;
    }

    /**
     * @notice Update the metadata URI for an agent. Only the owner can update.
     * @param agentId The token ID of the agent
     * @param newURI The new metadata URI
     */
    function updateAgentURI(uint256 agentId, string calldata newURI) external whenNotPaused {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        require(bytes(newURI).length > 0, "URI cannot be empty");

        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(agentId, newURI);
    }

    /**
     * @notice Get the metadata URI for an agent.
     * @param agentId The token ID
     * @return The agent's metadata URI
     */
    function getAgentURI(uint256 agentId) external view returns (string memory) {
        _requireOwned(agentId);
        return tokenURI(agentId);
    }

    /**
     * @notice Get the owner address of an agent.
     * @param agentId The token ID
     * @return The owner address
     */
    function getAgentOwner(uint256 agentId) external view returns (address) {
        return ownerOf(agentId);
    }

    /**
     * @notice Check if an address has registered an agent.
     * @param owner The address to check
     * @return Whether the address has an agent
     */
    function isRegistered(address owner) external view returns (bool) {
        return _hasRegistered[owner];
    }

    /**
     * @notice Get the agent ID for an owner address.
     * @param owner The address to look up
     * @return The agent token ID
     */
    function getAgentIdByOwner(address owner) external view returns (uint256) {
        require(_hasRegistered[owner], "Not registered");
        return _ownerToAgentId[owner];
    }

    /**
     * @notice Total number of agents registered.
     * @return Count of registered agents
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    // --- Owner functions ---

    function setRegistrationBond(uint256 newBond) external onlyOwner {
        uint256 oldBond = registrationBond;
        registrationBond = newBond;
        emit BondUpdated(oldBond, newBond);
    }

    function withdrawBonds(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = to.call{value: balance}("");
        require(success, "Withdraw failed");
        emit BondWithdrawn(to, balance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Overrides ---

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
