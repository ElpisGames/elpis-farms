// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libs/token/BEP20/IBEP20.sol";

interface IRewardsToken is IBEP20 {
    /**
     * @dev Creates `amount` tokens and assigns them to `_to`, increasing
     * the total supply.
     *
     * Requirements
     *
     * - `msg.sender` must be the token minter
     */
    function mint(address _to, uint256 _amount) external;
}
