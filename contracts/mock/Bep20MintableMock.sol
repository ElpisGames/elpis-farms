// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libs/token/BEP20/BEP20.sol";
import "../libs/access/Ownable.sol";

contract Bep20MintableMock is BEP20("Mock", "MOCK") {
    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }

    function getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
