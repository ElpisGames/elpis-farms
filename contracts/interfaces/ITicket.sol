// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
import "../libs/token/ERC1155/IERC1155.sol";

interface ITicket is IERC1155 {
    function getTicketInfo(uint256 tokenId)
        external
        view
        returns (
            uint256,
            uint256,
            string memory
        );

    function mint(
        address _owner,
        uint256 _tokenId,
        uint256 _amount
    ) external;

    function mintBatch(
        address _owner,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts
    ) external;

    function balanceOf(address account, uint256 tokenId)
        external
        view
        override
        returns (uint256);

    function burn(
        address owner,
        uint256 tokenId,
        uint256 amount
    ) external;
}
