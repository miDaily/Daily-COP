import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-web3";
import "hardhat-deploy";
import { node_url, accounts } from "./utils/network";

// Tasks
import "./tasks/mintDlyCop";
import "./tasks/getRoleMembers";
import "./tasks/grantRelayerRole";
import "./tasks/getRelayers";

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
	// Your type-safe config goes here
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			accounts: accounts(),
			deploy: ["deploy/hardhat/v1", "deploy/polygon/v1", "deploy/ethereum/v1"],
			tags: ["test", "local"],
		},
		mumbai: {
			url: node_url("mumbai"),
			accounts: accounts("mumbai"),
			deploy: ["deploy/polygon/v1"],
			tags: ["staging"],
		},
		polygon: {
			url: node_url("polygon"),
			accounts: accounts("polygon"),
			deploy: ["deploy/polygon/v1"],
			tags: ["production"],
		},
		goerli: {
			url: node_url("goerli"),
			accounts: accounts("goerli"),
			deploy: ["deploy/ethereum/v1"],
			tags: ["staging"],
		},
		ethereum: {
			url: node_url("ethereum"),
			accounts: accounts("ethereum"),
			deploy: ["deploy/ethereum/v1"],
			tags: ["production"],
		},
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY,
	},
	solidity: "0.8.4",
	namedAccounts: {
		deployer: {
			default: 0,
		},
		minter: {
			default: 1,
			polygon: "0x56EdBf72E30032D071bd09166984cCc74780334E",
		},
		childChainManager: {
			default: 1,
			mumbai: "0xb5505a6d998549090530911180f38aC5130101c6",
			polygon: "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
		},
		predicateProxy: {
			default: 1,
			goerli: "0x37c3bfC05d5ebF9EBb3FF80ce0bd0133Bf221BC8",
			ethereum: "0x9923263fA127b3d1484cFD649df8f1831c2A74e4",
		},
		burner: {
			default: 2,
		},
		dailyCopUser1: {
			default: 3,
		},
		defaultAdmin: {
			default: 4,
			polygon: "0x96C2770900f4D0Dd76819eca77cB3b40e119BdCe",
		},
		relayer: {
			default: 5,
			mumbai: "0xb14980e52336Ca08Ed605543550fE1eF83ef9AC5",
			polygon: "0x7DE09E26632aEe1E7a63a0d13f93855a460f6A67",
		},
		defaultAdminRelayer: {
			default: 6,
			polygon: "0x9C973BDc62b8812A60B4955aaDF87D028FeBD311",
		},
	},
};

export default config;
