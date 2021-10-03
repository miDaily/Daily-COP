import { task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

task(
	"mint-dlycop",
	"Mint amount of Daily COP token to account",
	async (args: { account: string; amount: string }, hre) => {
		const { ethers } = hre;
		const minterSigner = await ethers.getNamedSigner("minter");
		const tokenContract = await ethers.getContract("DailyCopTokenChild");

		await tokenContract
			.connect(minterSigner)
			.mint(args.account, ethers.utils.parseEther(args.amount));
	}
)
	.addParam("amount", "The amount to mint")
	.addParam("account", "The account's address");
