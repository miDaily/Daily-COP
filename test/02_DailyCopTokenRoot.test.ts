import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
const { expectRevert, constants, time } = require("@openzeppelin/test-helpers");

describe("DailyCopTokenRoot", () => {
	let dailyCopTokenRootContract: Contract;
	let deployer: string;
	let minter: string;
	let dailyCopUser1: string;
	let relayer: string;
	let defaultAdmin: string;
	let deployerSigner: SignerWithAddress;
	let minterSigner: SignerWithAddress;
	let burnerSigner: SignerWithAddress;
	let dailyCopUser1Signer: SignerWithAddress;
	let defaultAdminSigner: SignerWithAddress;
	let relayerSigner: SignerWithAddress;

	before(async () => {
		// Get the accounts
		const accounts = await getNamedAccounts();
		deployer = accounts["deployer"];
		minter = accounts["minter"];
		dailyCopUser1 = accounts["dailyCopUser1"];
		relayer = accounts["relayer"];
		defaultAdmin = accounts["defaultAdmin"];
		// Get the signers
		[
			deployerSigner,
			minterSigner,
			burnerSigner,
			dailyCopUser1Signer,
			defaultAdminSigner,
			relayerSigner,
		] = await ethers.getSigners();
	});

	beforeEach(async () => {
		// Make sure every test is started from a clean deployment fixture
		await deployments.fixture(["DailyCopTokenRoot", "MockERC20"]);
		// Get the contract to test
		dailyCopTokenRootContract = await ethers.getContract("DailyCopTokenRoot");
	});

	describe("deploy and upgrade", () => {
		it("should deploy the token with the correct info", async () => {
			const tokenSymbol = await dailyCopTokenRootContract.symbol();
			const tokenName = await dailyCopTokenRootContract.name();

			expect(tokenSymbol).to.equal("DLYCOP");
			expect(tokenName).to.equal("Daily COP");
		});

		it("should deploy the token with the correct roles set", async () => {
			// PREDICATE_ROLE
			expect(
				await dailyCopTokenRootContract.hasRole(
					ethers.utils.id("PREDICATE_ROLE"),
					minter
				)
			).to.be.true;
			expect(
				await dailyCopTokenRootContract.hasRole(
					ethers.utils.id("PREDICATE_ROLE"),
					deployer
				)
			).to.be.false;
			expect(
				await dailyCopTokenRootContract.hasRole(
					ethers.utils.id("PREDICATE_ROLE"),
					dailyCopUser1
				)
			).to.be.false;
			// OWNER
			expect(await dailyCopTokenRootContract.owner()).to.be.equal(defaultAdmin);
		});
	});

	describe("mint", () => {
		it("should not be able to mint without the PREDICATE_ROLE", async () => {
			await expectRevert(
				dailyCopTokenRootContract
					.connect(dailyCopUser1Signer)
					.mint(dailyCopUser1, ethers.utils.parseEther("1")),
				"VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
					dailyCopUser1.toLowerCase() +
					" is missing role " +
					ethers.utils.id("PREDICATE_ROLE") +
					"'"
			);
		});
		it("should not be able to mint to the zero address", async () => {
			await expectRevert(
				dailyCopTokenRootContract
					.connect(minterSigner)
					.mint(constants.ZERO_ADDRESS, ethers.utils.parseEther("1")),
				"ERC20: mint to the zero address"
			);
		});
		it("should increment the balance of the receiving address with the minted amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("1"),
				ethers.utils.parseEther("2"),
			];

			for await (const amount of testAmounts) {
				// Given
				const balanceBefore = await dailyCopTokenRootContract.balanceOf(
					dailyCopUser1
				);
				// When
				await dailyCopTokenRootContract
					.connect(minterSigner)
					.mint(dailyCopUser1, amount);
				// Then
				const balanceAfter = await dailyCopTokenRootContract.balanceOf(
					dailyCopUser1
				);
				const expectedBalanceAfter = balanceBefore.add(amount);
				expect(balanceAfter).to.be.equal(expectedBalanceAfter);
			}
		});

		it("should increment the total token supply with the minted amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("1"),
				ethers.utils.parseEther("2"),
			];

			for await (const amount of testAmounts) {
				// Given
				const totalSupplyBefore = await dailyCopTokenRootContract.totalSupply();
				// When
				await dailyCopTokenRootContract
					.connect(minterSigner)
					.mint(dailyCopUser1, amount);
				// Then
				const totalSupplyAfter = await dailyCopTokenRootContract.totalSupply();
				const expectedtotalSupplyAfter = totalSupplyBefore.add(amount);
				expect(totalSupplyAfter).to.be.equal(expectedtotalSupplyAfter);
			}
		});

		it("should emit a Transfer event", async () => {
			const amount = ethers.utils.parseEther("99999999");
			await expect(
				dailyCopTokenRootContract
					.connect(minterSigner)
					.mint(dailyCopUser1, amount)
			)
				.to.emit(dailyCopTokenRootContract, "Transfer")
				.withArgs(constants.ZERO_ADDRESS, dailyCopUser1, amount);
		});
	});

	describe("transfer", () => {
		const mintedAmount = ethers.utils.parseEther("99999999");

		beforeEach(async () => {
			// Mint some tokens that can be transfered in the tests
			await dailyCopTokenRootContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);
		});

		it("should mitigate accidental token loss by rejecting the contract's address as a recipient", async () => {
			await expectRevert(
				dailyCopTokenRootContract
					.connect(dailyCopUser1Signer)
					.transfer(dailyCopTokenRootContract.address, mintedAmount),
				"Address can not be the token contract's address"
			);
		});

		it("should debit the sender's account and credit the recipient's account", async () => {
			const balanceBeforeSender = await dailyCopTokenRootContract.balanceOf(
				dailyCopUser1
			);
			const balanceBeforeRecipient = await dailyCopTokenRootContract.balanceOf(
				relayer
			);

			await dailyCopTokenRootContract
				.connect(dailyCopUser1Signer)
				.transfer(relayer, mintedAmount);

			const balanceAfterSender = await dailyCopTokenRootContract.balanceOf(
				dailyCopUser1
			);
			const balanceAfterRecipient = await dailyCopTokenRootContract.balanceOf(
				relayer
			);

			expect(balanceAfterSender).to.be.equal(
				balanceBeforeSender.sub(mintedAmount)
			);
			expect(balanceAfterRecipient).to.be.equal(
				balanceBeforeRecipient.add(mintedAmount)
			);
		});
	});

	describe("transferFrom", () => {
		const mintedAmount = ethers.utils.parseEther("99999999");
		const approvedAmount = ethers.utils.parseEther("10000000");

		beforeEach(async () => {
			// Mint some tokens that can be transfered in the tests
			await dailyCopTokenRootContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);
			await dailyCopTokenRootContract
				.connect(dailyCopUser1Signer)
				.approve(relayer, approvedAmount);
		});

		it("should mitigate accidental token loss by rejecting the contract's address as a recipient", async () => {
			await expectRevert(
				dailyCopTokenRootContract
					.connect(relayerSigner)
					.transferFrom(
						dailyCopUser1,
						dailyCopTokenRootContract.address,
						approvedAmount
					),
				"Address can not be the token contract's address"
			);
		});

		it("should debit the owner's account and credit the recipient's account", async () => {
			const recipient = deployer;
			const balanceBeforeOwner = await dailyCopTokenRootContract.balanceOf(
				dailyCopUser1
			);
			const balanceBeforeRecipient = await dailyCopTokenRootContract.balanceOf(
				recipient
			);

			await dailyCopTokenRootContract
				.connect(relayerSigner)
				.transferFrom(dailyCopUser1, recipient, approvedAmount);

			const balanceAfterOwner = await dailyCopTokenRootContract.balanceOf(
				dailyCopUser1
			);
			const balanceAfterRecipient = await dailyCopTokenRootContract.balanceOf(
				deployer
			);

			expect(balanceAfterOwner).to.be.equal(
				balanceBeforeOwner.sub(approvedAmount)
			);
			expect(balanceAfterRecipient).to.be.equal(
				balanceBeforeRecipient.add(approvedAmount)
			);
		});
	});

	describe("permit", () => {
		const mintedAmount = ethers.utils.parseEther("99999999");
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

		beforeEach(async () => {
			// Mint some tokens that can be withdrawn in the tests
			await dailyCopTokenRootContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);

			// Create valid permit data that can be used in the tests
			const chainId = await getChainId();
			const latest = await time.latest();
			const deadline = Number(latest) + Number(time.duration.hours(1));
			const nonce = await dailyCopTokenRootContract.nonces(dailyCopUser1);
			domain = {
				name: "DailyCopToken",
				version: "1",
				chainId,
				verifyingContract: dailyCopTokenRootContract.address,
			};

			values = {
				owner: dailyCopUser1,
				spender: relayer,
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

		it("should fail with a passed deadline", async () => {
			// Create a passed deadline and add it to the values to sign
			const latest = await time.latest();
			const deadline = Number(latest) - Number(time.duration.hours(1));
			values.deadline = deadline;

			const res = await dailyCopUser1Signer._signTypedData(
				domain,
				types,
				values
			);
			const signature = res.substring(2);

			const r = "0x" + signature.substring(0, 64);
			const s = "0x" + signature.substring(64, 128);
			const v = parseInt(signature.substring(128, 130), 16);

			await expectRevert(
				dailyCopTokenRootContract
					.connect(relayerSigner)
					.permit(
						dailyCopUser1,
						relayer,
						String(mintedAmount),
						deadline,
						v,
						r,
						s
					),
				"ERC20Permit: expired deadline"
			);
		});

		it("should fail with a used nonce", async () => {
			const res = await dailyCopUser1Signer._signTypedData(
				domain,
				types,
				values
			);
			const signature = res.substring(2);

			const r = "0x" + signature.substring(0, 64);
			const s = "0x" + signature.substring(64, 128);
			const v = parseInt(signature.substring(128, 130), 16);

			// Send the signature with a nonce included
			await dailyCopTokenRootContract
				.connect(relayerSigner)
				.permit(
					dailyCopUser1,
					relayer,
					String(mintedAmount),
					values.deadline,
					v,
					r,
					s
				);
			// Send the same valid signature but with the same nonce again so it should not be accepted again
			await expectRevert(
				dailyCopTokenRootContract
					.connect(relayerSigner)
					.permit(
						dailyCopUser1,
						relayer,
						String(mintedAmount),
						values.deadline,
						v,
						r,
						s
					),
				"ERC20Permit: invalid signature"
			);
		});

		it("should increment the allowance of the spender with the amount", async () => {
			const allowanceBefore = await dailyCopTokenRootContract.allowance(
				dailyCopUser1,
				relayer
			);
			const res = await dailyCopUser1Signer._signTypedData(
				domain,
				types,
				values
			);
			const signature = res.substring(2);

			const r = "0x" + signature.substring(0, 64);
			const s = "0x" + signature.substring(64, 128);
			const v = parseInt(signature.substring(128, 130), 16);

			await dailyCopTokenRootContract
				.connect(relayerSigner)
				.permit(
					dailyCopUser1,
					relayer,
					String(mintedAmount),
					values.deadline,
					v,
					r,
					s
				);

			const allowanceAfter = await dailyCopTokenRootContract.allowance(
				dailyCopUser1,
				relayer
			);

			expect(allowanceAfter).to.be.equal(allowanceBefore.add(mintedAmount));
		});

		it("should emit an Approved event", async () => {
			const res = await dailyCopUser1Signer._signTypedData(
				domain,
				types,
				values
			);
			const signature = res.substring(2);

			const r = "0x" + signature.substring(0, 64);
			const s = "0x" + signature.substring(64, 128);
			const v = parseInt(signature.substring(128, 130), 16);

			await expect(
				dailyCopTokenRootContract
					.connect(relayerSigner)
					.permit(
						dailyCopUser1,
						relayer,
						String(mintedAmount),
						values.deadline,
						v,
						r,
						s
					)
			)
				.to.emit(dailyCopTokenRootContract, "Approval")
				.withArgs(dailyCopUser1, relayer, mintedAmount);
		});
	});

	describe("transferAnyERC20", () => {
		let mockERC20Contract: Contract;
		const mintedAmount = ethers.utils.parseEther("99999999");

		beforeEach(async () => {
			mockERC20Contract = await ethers.getContract("MockERC20");
			// Mint some mock tokens that can be transfered in the tests
			await mockERC20Contract
				.connect(deployerSigner)
				.mint(dailyCopTokenRootContract.address, mintedAmount);
		});

		it("can not be done by anyone else than the default admin", async () => {
			await expectRevert(
				dailyCopTokenRootContract
					.connect(dailyCopUser1Signer)
					.transferAnyERC20(
						mockERC20Contract.address,
						dailyCopUser1,
						mintedAmount
					),
				"Ownable: caller is not the owner"
			);
		});

		it("should transfer any ERC20 token that the contract holds to a recipient", async () => {
			const contractBalanceBefore = await mockERC20Contract.balanceOf(
				dailyCopTokenRootContract.address
			);
			const recipientBalanceBefore = await mockERC20Contract.balanceOf(
				dailyCopUser1
			);

			dailyCopTokenRootContract
				.connect(defaultAdminSigner)
				.transferAnyERC20(
					mockERC20Contract.address,
					dailyCopUser1,
					mintedAmount
				);

			const contractBalanceAfter = await mockERC20Contract.balanceOf(
				dailyCopTokenRootContract.address
			);
			const recipientBalanceAfter = await mockERC20Contract.balanceOf(
				dailyCopUser1
			);

			expect(contractBalanceAfter).to.be.equal(
				contractBalanceBefore.sub(mintedAmount)
			);
			expect(recipientBalanceAfter).to.be.equal(
				recipientBalanceBefore.add(mintedAmount)
			);
		});
	});
});
