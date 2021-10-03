# Daily COP (DLYCOP)

This repository contains the token and relayer contracts of the Daily COP (Colombian Peso) stablecoin.

The DLY COP token is an ERC20 token that:

- can be minted by an account with the MINTER_ROLE. Initially this will be centralized and done by a multisig address controlled by different stakeholders in Daily, in a later fase the token will be collateralized on-chain and minting will on be possible with a deposit of collateral, making it more decentralized.
- can be burned by the same token holder or anyone who was approved the allowance of the token.
- has the permit functionality as described in https://eips.ethereum.org/EIPS/eip-2612[EIP-2612] allowing approvals to be made via signatures so we can more easily create services to cover for the transaction costs of users.
- has snapshot functionality that can be used in case any migration has to be done or any rewards need to be given to token holders.
- will be deployed on the layer 2 solution Polygon with the contract "DailyCopTokenChild" and on layer 1 Ethereum with the contract "DailyCopTokenRoot".
- can be moved to and from layer 1 (Ethereum) using the Matic Bridge, for which the deposit and withdrawal functions are implemented in the Child token contract and the mint function in the Root token contrat is limited to the Predicate Proxy contract of the Bridge.
- currently has a DEFAULT_ADMIN_ROLE to control and change the roles (MINTER_ROLE, SNAPSHOT_ROLE and DEPOSITOR_ROLE) in case it is necessary. Once the collateralization protocol is implemented and minting is done automatically through the protocol, the DEFAULT_ADMIN_ROLE may dissapear by making the only granted account renounce from it.

The Relayer contract is added so that transactions can be signed by users and relayed by other accounts (trusted relayers with the RELAYER_ROLE) that will pay for the gas fee. It makes use of the permit function in the token contract and makes it possible to do a permit and transferFrom in one and the same transaction. In the future we will charge a fee in the own DLY COP token, which will be transparent in the Relayer contract. To be able to update this fee model, this contract is upgradeable. In the future we will not only have transfers with permit, but any action that can be done with our token, for example exchanges, without the need for the user to have the native network currency. The contract will also be improved so the relaying can be done by any account instead of needing the RELAYER_ROLE, but for now the RELAYER_ROLE will only be given to accounts of trusted services of Daily, so we can make sure the tokens are send to the intented recipient, since this is not part of the permit signature.

## Dev Guide

### How-to's

#### Verify token on etherscan

To verify contracts on etherscan the [hardhat-etherscan](https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html "@nomiclabs/hardhat-etherscan") plugin of nomiclabs can be used.

If you want to get a contract verified on etherscan you can use the following command with the correct parameters:

```sh
npx hardhat verify --network <network_name> <deployed_contract_address> "<constructor_arg_1>"

# Example to verify DailyCopTokenRoot deployed at 0xB32429ACdd55a95561a12476ec37E6A941aCc2Ee on Goerli with the predicate proxy argument as 0x37c3bfC05d5ebF9EBb3FF80ce0bd0133Bf221BC8
npx hardhat verify --network goerli 0xB32429ACdd55a95561a12476ec37E6A941aCc2Ee "0x37c3bfC05d5ebF9EBb3FF80ce0bd0133Bf221BC8"

# Successfull verification will return a message similar to the following:

# Successfully verified contract DailyCopTokenRoot on Etherscan.
# https://goerli.etherscan.io/address/0xB32429ACdd55a95561a12476ec37E6A941aCc2Ee#code
```

Make sure you first created an API key on etherscan and have added it to `ETHERSCAN_API_KEY` in your local `.env` file.

#### Verify token on polygonscan

To verify a contract on polygonscan no plugin exists yet as in the case of etherscan, but you can do it manually.

- For the Mumbai testnet on: https://mumbai.polygonscan.com/verifyContract
- For the Matic mainnet on: https://polygonscan.com/verifyContract

Since our contracts use libraries and so exists out of mulitple files they should first be flattened to be accepted. This can be done by the build-in flatten task of hardhat:

```sh
npx hardhat flatten <...files>

# Example to flatten the DailyCopTokenChild.sol contract
npx hardhat flatten contracts/polygon/DailyCopTokenChild.sol
```

The flattened code can now be uploaded as a single file Solidity contract.

When you verify and publish your code, it is possible the following error is returned:

```sh
ParserError: Multiple SPDX license identifiers found in source file. Use "AND" or "OR" to combine multiple licenses. Please see https://spdx.org for more information.
--> myc
```

In this case you should remove all but one `// SPDX-License-Identifier:` comments from the flattened code before pasting it in.

#### Map token on Matic PoS bridge

To map our token on the Matic bridge, so it can be moved off of Matic to Ethereum and back, it should be listed on Matic's PoS bridge.
This proces is currently still manual through a user interface and controlled by the Matic developers. In the future this will become more decentralized.

A requisite to get accepted is to have both the token contract on Matic as the contract on Ethereum verified, see sections [Verify token on etherscan](#verify-token-on-etherscan) and [Verify token on polygonscan](#verify-token-on-polygonscan) if this is not done yet.

If the token contract is accepted on both layers, go to https://mapper.matic.today/map, choose the PoS bridge, ERC20, the networks (mainnet or testnet) and set the token as mintable.
Now enter the addresses of the contracts on both layers and make sure the token symbol appears automatically to make sure the contract is recognised.
Also enter your email address on which you want to receive any notifications and you can Submit the request.

In the coming days you can check if it got mapped on the bridge in the following explorer: https://mapper.matic.today/.
