import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const contractName = "Relayer";
const version = "v1";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, get } = deployments;
	const { deployer, defaultAdminRelayer, relayer } = await getNamedAccounts();

	const dailyToken = await get("DailyCopTokenChild");

	await deploy(contractName, {
		from: deployer,
		proxy: {
			owner: defaultAdminRelayer,
			proxyContract: "OpenZeppelinTransparentProxy",
			execute: {
				init: {
					methodName: "initialize",
					args: [defaultAdminRelayer, relayer, dailyToken.address],
				},
			},
		},
		log: true,
	});
};

export default func;
func.tags = [contractName, version];
func.id = contractName + version;
func.dependencies = ["DailyCopTokenChild"];
