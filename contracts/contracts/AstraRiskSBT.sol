// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AstraRiskSBT is ERC721, Ownable {
    uint256 private _tokenIds;
    
    mapping(address => uint256) public userScore;
    mapping(address => bool) public hasMinted;

    event Minted(address indexed to, uint256 score);
    event ScoreUpdated(address indexed to, uint256 score);

    constructor() ERC721("AstraRisk Credit Identity", "ASTRA") Ownable(msg.sender) {}

    function mint(address to, uint256 score) public onlyOwner {
        require(!hasMinted[to], "User already has an identity SBT");
        _tokenIds++;
        uint256 newItemId = _tokenIds;
        _safeMint(to, newItemId);
        userScore[to] = score;
        hasMinted[to] = true;
        emit Minted(to, score);
    }

    function updateScore(address to, uint256 score) public onlyOwner {
        require(hasMinted[to], "User does not have an identity SBT");
        userScore[to] = score;
        emit ScoreUpdated(to, score);
    }

    function getScore(address user) public view returns (uint256) {
        return userScore[user];
    }

    // Soulbound logic: Disable transfers
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("SBT: Transfer not allowed");
        }
        return super._update(to, tokenId, auth);
    }
}
