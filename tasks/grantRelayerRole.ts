import { task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

task(
	"grant-relayer-role",
	"Grant the relayer role to an address",
	async (args: { address: string }, hre) => {
		const { ethers } = hre;
		const relayerContract = await ethers.getContract("Relayer");
		const defaultAdminRelayerSigner = await ethers.getNamedSigner(
			"defaultAdminRelayer"
		);

		await relayerContract
			.connect(defaultAdminRelayerSigner)
			.grantRole(ethers.utils.id("RELAYER_ROLE"), args.address);
	}
).addParam("address", "The address that will get the role");
