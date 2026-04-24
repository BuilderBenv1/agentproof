// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BITE — minimal vendored wrapper for SKALE BITE precompiles
 * @notice Mirrors the surface of @skalenetwork/bite-solidity LegacyBITE.sol so
 *         this repo can compile via solcx without pulling in the foundry
 *         toolchain. Faithful to the upstream interface — same precompile
 *         addresses, same submitCTX shape.
 *
 *         Reference: https://github.com/skalenetwork/bite-solidity
 */
library BITE {
    address internal constant SUBMIT_CTX_ADDRESS = 0x000000000000000000000000000000000000001B;
    address internal constant ENCRYPT_ECIES_ADDRESS = 0x000000000000000000000000000000000000001c;
    address internal constant ENCRYPT_TE_ADDRESS = 0x000000000000000000000000000000000000001D;

    error SubmitCTXFailed();
    error EncryptTEFailed();

    /**
     * @notice Submit encrypted args to BITE for threshold decryption.
     * @return callbackSender The temporary contract that will invoke onDecrypt.
     *         The caller MUST transfer the gas payment to this address.
     */
    function submitCTX(
        address precompile,
        uint256 gasLimit,
        bytes[] memory encryptedArguments,
        bytes[] memory plaintextArguments
    ) internal returns (address payable callbackSender) {
        bytes memory payload = abi.encode(gasLimit, encryptedArguments, plaintextArguments);
        (bool ok, bytes memory ret) = precompile.call(payload);
        if (!ok || ret.length < 32) revert SubmitCTXFailed();
        callbackSender = payable(abi.decode(ret, (address)));
    }

    /**
     * @notice TE-encrypt arbitrary data with the network BLS threshold key.
     */
    function encryptTE(address precompile, bytes memory data)
        internal
        view
        returns (bytes memory ciphertext)
    {
        (bool ok, bytes memory ret) = precompile.staticcall(data);
        if (!ok) revert EncryptTEFailed();
        ciphertext = ret;
    }
}

/**
 * @title IBiteSupplicant — callback interface invoked by BITE after threshold decryption
 */
interface IBiteSupplicant {
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external;
}
