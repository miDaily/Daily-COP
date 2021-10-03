// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IChildToken is IERC20 {
	/**
	 * @notice called when token is deposited on root chain
	 * @dev Should be callable only by ChildChainManager
	 * Should handle deposit by minting the required amount for user, not to create new tokens,
	 * but to move tokens previously swapped to the root chain back to the child chain
	 * @param user user address for whom deposit is being done
	 * @param depositData abi encoded amount
	 */
	function deposit(address user, bytes calldata depositData) external;
}
