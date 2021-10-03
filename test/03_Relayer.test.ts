import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
const { time, expectRevert } = require("@openzeppelin/test-helpers");

const mintedAmount = ethers.utils.parseEther("100000");

describe("Relayer", () => {
	let dailyCopTokenChildContract: Contract;
	let relayerContract: Contract;
	let deployer: string;
	let minter: string;
	let burner: string;
	let dailyCopUser1: string;
	let defaultAdmin: string;
	let relayer: string;
	let defaultAdminRelayer: string;
	let deployerSigner: SignerWithAddress;
	let minterSigner: SignerWithAddress;
	let burnerSigner: SignerWithAddress;
	let dailyCopUser1Signer: SignerWithAddress;
	let defaultAdminSigner: SignerWithAddress;
	let relayerSigner: SignerWithAddress;
	let defaultAdminRelayerSigner: SignerWithAddress;
	let domain: {
		name: string;
		version: string;
		chainId: string;
		verifyingContract: string;
	};
	let types: {
		Permit: [
			{ name: string; type: string },
			{ name: string; type: string },
			{ name: string; type: string },
			{ name: string; type: string },
			{ name: string; type: string }
		];
	};
	let values: {
		owner: string;
		spender: string;
		value: BigNumber;
		nonce: number;
		deadline: number;
	};

	before(async () => {
		// Get the accounts
		const accounts = await getNamedAccounts();
		deployer = accounts["deployer"];
		minter = accounts["minter"];
		burner = accounts["burner"];
		dailyCopUser1 = accounts["dailyCopUser1"];
		defaultAdmin = accounts["defaultAdmin"];
		relayer = accounts["relayer"];
		defaultAdminRelayer = accounts["defaultAdminRelayer"];
		// Get the signers
		[
			deployerSigner,
			minterSigner,
			burnerSigner,
			dailyCopUser1Signer,
			defaultAdminSigner,
			relayerSigner,
			defaultAdminRelayerSigner,
		] = await ethers.getSigners();
	});

	beforeEach(async () => {
		// Make sure every test is started from a clean deployment fixture
		await deployments.fixture("Relayer");

		// Get the contract to test
		dailyCopTokenChildContract = await ethers.getContract("DailyCopTokenChild");
		relayerContract = await ethers.getContract("Relayer");

		// Set the test minter
		await dailyCopTokenChildContract
			.connect(defaultAdminSigner)
			.grantRole(ethers.utils.id("MINTER_ROLE"), minter);

		await dailyCopTokenChildContract
			.connect(minterSigner)
			.mint(dailyCopUser1, mintedAmount);

		const chainId = await getChainId();
		const latest = await time.latest();
		const deadline = Number(latest) + Number(time.duration.hours(1));
		const nonce = await dailyCopTokenChildContract.nonces(dailyCopUser1);

		domain = {
			name: "DailyCopToken",
			version: "1",
			chainId,
			verifyingContract: dailyCopTokenChildContract.address,
		};

		values = {
			owner: dailyCopUser1,
			spender: relayerContract.address,
			value: mintedAmount,
			nonce: Number(nonce),
			deadline,
		};

		types = {
			Permit: [
				{ name: "owner", type: "address" },
				{ name: "spender", type: "address" },
				{ name: "value", type: "uint256" },
				{ name: "nonce", type: "uint256" },
				{ name: "deadline", type: "uint256" },
			],
		};
	});

	it("should deploy the contract with the correct roles set", async () => {
		// DEFAULT_ADMIN_ROLE
		const defaultAdminRole = await relayerContract.DEFAULT_ADMIN_ROLE();
		expect(await relayerContract.hasRole(defaultAdminRole, defaultAdminRelayer))
			.to.be.true;
		expect(await relayerContract.hasRole(defaultAdminRole, deployer)).to.be
			.false;
		expect(await relayerContract.hasRole(defaultAdminRole, minter)).to.be.false;
		expect(await relayerContract.hasRole(defaultAdminRole, dailyCopUser1)).to.be
			.false;
		expect(await relayerContract.hasRole(defaultAdminRole, defaultAdmin)).to.be
			.false;
		// First RELAYER_ROLE
		expect(
			await relayerContract.hasRole(ethers.utils.id("RELAYER_ROLE"), relayer)
		).to.be.true;
	});

	it("only relayer should be able to transferFrom using permit", async () => {
		const res = await dailyCopUser1Signer._signTypedData(domain, types, values);
		const signature = res.substring(2);

		const r = "0x" + signature.substring(0, 64);
		const s = "0x" + signature.substring(64, 128);
		const v = parseInt(signature.substring(128, 130), 16);

		await expectRevert(
			relayerContract
				.connect(dailyCopUser1Signer)
				.transferWithPermit(
					dailyCopUser1,
					burner,
					String(mintedAmount),
					values.deadline,
					v,
					r,
					s
				),
			`AccessControl: account ${dailyCopUser1.toLowerCase()} is missing role 0xe2b7fb3b832174769106daebcfd6d1970523240dda11281102db9363b83b0dc4`
		);
	});

	it("should be set with a fixed cost of 100 DLY COP", async () => {
		const cost = await relayerContract.getCost();
		expect(cost).to.be.equal(ethers.utils.parseEther("100"));
	});

	it("should not permit a value that can not cover the cost and a transfer", async () => {
		const cost = await relayerContract.getCost();

		values.value = cost;

		const res = await dailyCopUser1Signer._signTypedData(domain, types, values);
		const signature = res.substring(2);

		const r = "0x" + signature.substring(0, 64);
		const s = "0x" + signature.substring(64, 128);
		const v = parseInt(signature.substring(128, 130), 16);

		await expectRevert(
			relayerContract
				.connect(relayerSigner)
				.transferWithPermit(
					dailyCopUser1,
					burner,
					cost,
					values.deadline,
					v,
					r,
					s
				),
			"The value is not enough to cover the cost and a transfer"
		);
	});

	it("should send the cost to the relayer and the rest to the recipient", async () => {
		const cost = await relayerContract.getCost();
		const amountForRecipient = mintedAmount.sub(cost);
		const initialBalanceRecipient = await dailyCopTokenChildContract.balanceOf(
			burner
		);
		const initialBalanceRelayer = await dailyCopTokenChildContract.balanceOf(
			relayer
		);
		const initialBalanceSender = await dailyCopTokenChildContract.balanceOf(
			dailyCopUser1
		);

		const res = await dailyCopUser1Signer._signTypedData(domain, types, values);
		const signature = res.substring(2);

		const r = "0x" + signature.substring(0, 64);
		const s = "0x" + signature.substring(64, 128);
		const v = parseInt(signature.substring(128, 130), 16);

		await relayerContract
			.connect(relayerSigner)
			.transferWithPermit(
				dailyCopUser1,
				burner,
				String(mintedAmount),
				values.deadline,
				v,
				r,
				s
			);

		const finalBalanceRecipient = await dailyCopTokenChildContract.balanceOf(
			burner
		);
		const finalBalanceRelayer = await dailyCopTokenChildContract.balanceOf(
			relayer
		);
		const finalBalanceSender = await dailyCopTokenChildContract.balanceOf(
			dailyCopUser1
		);

		expect(finalBalanceRecipient).to.be.equal(
			initialBalanceRecipient.add(amountForRecipient)
		);
		expect(finalBalanceRelayer).to.be.equal(initialBalanceRelayer.add(cost));
		expect(finalBalanceSender).to.be.equal(
			initialBalanceSender.sub(mintedAmount)
		);
	});
});
