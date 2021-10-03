import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const contractName = "DailyCopTokenChild";
const version = "v1";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;
	const { deployer, childChainManager, minter, defaultAdmin } =
		await getNamedAccounts();

	await deploy(contractName, {
		from: deployer,
		log: true,
		args: [defaultAdmin, minter, childChainManager],
	});
};

export default func;
func.tags = [contractName, version];
func.id = contractName + version;
