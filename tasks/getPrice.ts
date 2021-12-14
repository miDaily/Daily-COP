import { task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

task(
	"get-price",
	"Get the price rate of USD to Daily COP",
	async (args, hre) => {
		const { ethers, getNamedAccounts } = hre;
		const accounts = await getNamedAccounts();
		const pairContractAddress = accounts["quickswapPairWithUSDT"];
		const DailyCopUSDTPairContract = await ethers.getContractAt(
			[
				{
					constant: true,
					inputs: [],
					name: "getReserves",
					outputs: [
						{ internalType: "uint112", name: "_reserve0", type: "uint112" },
						{ internalType: "uint112", name: "_reserve1", type: "uint112" },
						{
							internalType: "uint32",
							name: "_blockTimestampLast",
							type: "uint32",
						},
					],
					payable: false,
					stateMutability: "view",
					type: "function",
				},
			],
			pairContractAddress
		);

		const reserves = await DailyCopUSDTPairContract.getReserves();
		const dlycopReserve = reserves._reserve0;
		const usdtReserve = reserves._reserve1;
		const usdtReserveBase18Decimals = usdtReserve.mul(10 ** 12);
		const trm = dlycopReserve.div(usdtReserveBase18Decimals);
		console.log("TRM", Number(trm));
	}
);
