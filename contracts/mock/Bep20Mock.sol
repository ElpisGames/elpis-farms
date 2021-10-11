// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;

import "../libs/token/BEP20/BEP20.sol";

contract BEP20Mock is BEP20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 supply
    ) public BEP20(name, symbol) {
        _mint(msg.sender, supply);
    }
}
