// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./../interfaces/IChildToken.sol";

contract DailyCopTokenChild is
	AccessControlEnumerable,
	ERC20Burnable,
	ERC20Snapshot,
	ERC20Permit,
	IChildToken
{
	uint256 private _layer1Supply;

	// Roles
	bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
	bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
	bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

	modifier notThisAddress(address account) {
		require(
			account != address(this),
			"Address can not be the token contract's address"
		);
		_;
	}

	constructor(
		address defaultAdmin,
		address minter,
		address childChainManager
	) ERC20("Daily COP", "DLYCOP") ERC20Permit("DailyCopToken") {
		_setupRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
		_setupRole(MINTER_ROLE, minter);

		// Only the child chain manager knows when a token is deposited on the root chain
		_setupRole(DEPOSITOR_ROLE, childChainManager);
	}

	/** @dev Creates `amount` tokens and assigns them to `account`, increasing
	 * the total supply.
	 *
	 * Emits a {Transfer} event with `from` set to the zero address.
	 *
	 * Requirements:
	 *
	 * - `account` cannot be the zero address.
	 * - `msg.sender` should have the minter role (MINTER_ROLE).
	 */
	function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
		_mint(to, amount);
	}

	/**
	 * @dev See {IERC20-transfer}.
	 *
	 * Requirements:
	 *
	 * - `recipient` cannot be the zero address.
	 * - the caller must have a balance of at least `amount`.
	 */
	function transfer(address recipient, uint256 amount)
		public
		virtual
		override(ERC20, IERC20)
		notThisAddress(recipient)
		returns (bool)
	{
		return super.transfer(recipient, amount);
	}

	/**
	 * @dev See {IERC20-transferFrom}.
	 *
	 * Emits an {Approval} event indicating the updated allowance. This is not
	 * required by the EIP. See the note at the beginning of {ERC20}.
	 *
	 * Requirements:
	 *
	 * - `sender` and `recipient` cannot be the zero address.
	 * - `sender` must have a balance of at least `amount`.
	 * - the caller must have allowance for ``sender``'s tokens of at least
	 * `amount`.
	 */
	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	)
		public
		virtual
		override(ERC20, IERC20)
		notThisAddress(recipient)
		returns (bool)
	{
		return super.transferFrom(sender, recipient, amount);
	}

	/**
	 * @dev Creates a new snapshot and returns its snapshot id.
	 *
	 * Emits a {Snapshot} event that contains the same id.
	 *
	 * {_snapshot} is `internal` and you have to decide how to expose it externally. Its usage may be restricted to a
	 * set of accounts, for example using {AccessControl}, or it may be open to the public.
	 *
	 * [WARNING]
	 * ====
	 * While an open way of calling {_snapshot} is required for certain trust minimization mechanisms such as forking,
	 * you must consider that it can potentially be used by attackers in two ways.
	 *
	 * First, it can be used to increase the cost of retrieval of values from snapshots, although it will grow
	 * logarithmically thus rendering this attack ineffective in the long term. Second, it can be used to target
	 * specific accounts and increase the cost of ERC20 transfers for them, in the ways specified in the Gas Costs
	 * section above.
	 *
	 * We haven't measured the actual numbers; if this is something you're interested in please reach out to us.
	 * ====
	 */
	function snapshot() public onlyRole(SNAPSHOT_ROLE) {
		_snapshot();
	}

	/**
	 * @notice called when token is deposited on root chain
	 * @dev Should be callable only by ChildChainManager
	 * Should handle deposit by minting the required amount for user, not to create new tokens,
	 * but to move tokens previously swapped to the root chain back to the child chain
	 * @param user user address for whom deposit is being done
	 * @param depositData abi encoded amount
	 */
	function deposit(address user, bytes calldata depositData)
		external
		override
		onlyRole(DEPOSITOR_ROLE)
	{
		uint256 amount = abi.decode(depositData, (uint256));
		// Keep track of token supply on layer 1 (root chain)
		_layer1Supply -= amount;
		_mint(user, amount);
	}

	/**
	 * @notice called when user wants to withdraw tokens back to root chain
	 * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
	 * @param amount amount of tokens to withdraw
	 */
	function withdraw(uint256 amount) external {
		// Keep track of token supply on layer 1 (root chain)
		_layer1Supply += amount;
		_burn(_msgSender(), amount);
	}

	/**
	 * @notice called when admin wants to unlock erc20 tokens owned by the contract
	 * @param _tokenAddress the address of the tokens to unlock
	 * @param _to the address to send the tokens to
	 * @param _amount amount of tokens to unlock
	 */
	function transferAnyERC20(
		address _tokenAddress,
		address _to,
		uint256 _amount
	) public onlyRole(DEFAULT_ADMIN_ROLE) {
		IERC20(_tokenAddress).transfer(_to, _amount);
	}

	/**
	 * @notice Obtain the supply of tokens that were moved to layer 1 (Ethereum) through the Polygon PoS bridge.
	 */
	function layer1Supply() public view returns (uint256) {
		return _layer1Supply;
	}

	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 amount
	) internal virtual override(ERC20, ERC20Snapshot) {
		super._beforeTokenTransfer(from, to, amount);
	}
}
