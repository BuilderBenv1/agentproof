// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAttestationProvider.sol";

/**
 * @title MockAttestationProvider — Test-only mock for attestation verification
 */
contract MockAttestationProvider is IAttestationProvider {
    mapping(address => bool) private _results;
    bool private _defaultResult;

    function setResult(address subject, bool pass) external {
        _results[subject] = pass;
    }

    function setDefaultResult(bool pass) external {
        _defaultResult = pass;
    }

    function verify(address subject, bytes32 /* conditionHash */) external view override returns (bool pass) {
        if (_results[subject]) return true;
        return _defaultResult;
    }
}
