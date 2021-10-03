import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const contractName = "DailyCopTokenRoot";
const version = "v1";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer, predicateProxy, defaultAdmin } = await getNamedAccounts();

	await deploy(contractName, {
		from: deployer,
		log: true,
		args: [defaultAdmin, predicateProxy],
	});
};

export default func;
func.tags = [contractName, version];
func.id = contractName + version;
