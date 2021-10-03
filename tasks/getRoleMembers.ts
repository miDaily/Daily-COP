import { task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

task("get-role-members", "Get the member addresses of a certain role",
  async (args: { role: string }, hre) => {
    const { ethers } = hre;
    const tokenContract = await ethers.getContract("DailyCopTokenChild");
    const role = args.role == "DEFAULT_ADMIN_ROLE" ? await tokenContract.DEFAULT_ADMIN_ROLE() : ethers.utils.id(args.role);
    const roleCount = await tokenContract.getRoleMemberCount(role);
    
    for (let i = 0; i < roleCount; ++i) {
      console.log(args.role + " " + i + ": " + await tokenContract.getRoleMember(role, i));
    }

  }).addParam("role", "The role to get the members from");