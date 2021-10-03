import { task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

task("get-relayers", "Get the member addresses of with relayer role",
  async (args, hre) => {
    const {ethers} = hre;
    const relayerContract = await ethers.getContract("Relayer");
    const roleName = "RELAYER_ROLE";
    const role = ethers.utils.id(roleName);
    const roleCount = await relayerContract.getRoleMemberCount(role);
    
    for (let i = 0; i < roleCount; ++i) {
      console.log(roleName + " " + i + ": " + await relayerContract.getRoleMember(role, i));
    }
  }
);