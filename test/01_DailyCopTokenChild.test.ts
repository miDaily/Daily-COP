import {
	ethers,
	deployments,
	getNamedAccounts,
	web3,
	getChainId,
} from "hardhat";
import { BigNumber, Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import Web3 from "web3";
const { expectRevert, constants, time } = require("@openzeppelin/test-helpers");
const abiCoder: Web3["eth"]["abi"] = web3.eth.abi;

describe("DailyCopTokenChild", () => {
	let dailyCopTokenChildContract: Contract;
	let deployer: string;
	let minter: string;
	let burner: string;
	let dailyCopUser1: string;
	let defaultAdmin: string;
	let relayer: string;
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
		burner = accounts["burner"];
		dailyCopUser1 = accounts["dailyCopUser1"];
		defaultAdmin = accounts["defaultAdmin"];
		relayer = accounts["relayer"];
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
		await deployments.fixture(["DailyCopTokenChild", "MockERC20"]);

		// Get the contract to test
		dailyCopTokenChildContract = await ethers.getContract("DailyCopTokenChild");
	});

	describe("deploy and upgrade", () => {
		it("should deploy the token with the correct info", async () => {
			const tokenSymbol = await dailyCopTokenChildContract.symbol();
			const tokenName = await dailyCopTokenChildContract.name();

			expect(tokenSymbol).to.equal("DLYCOP");
			expect(tokenName).to.equal("Daily COP");
		});

		it("should deploy the token with the correct roles set", async () => {
			// DEFAULT_ADMIN_ROLE
			const defaultAdminRole =
				await dailyCopTokenChildContract.DEFAULT_ADMIN_ROLE();
			expect(
				await dailyCopTokenChildContract.hasRole(defaultAdminRole, defaultAdmin)
			).to.be.true;
			expect(
				await dailyCopTokenChildContract.hasRole(defaultAdminRole, deployer)
			).to.be.false;
			expect(await dailyCopTokenChildContract.hasRole(defaultAdminRole, minter))
				.to.be.false;
			expect(
				await dailyCopTokenChildContract.hasRole(
					defaultAdminRole,
					dailyCopUser1
				)
			).to.be.false;
			// DEPOSITOR_ROLE
			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("DEPOSITOR_ROLE"),
					minter
				)
			).to.be.true;
			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("DEPOSITOR_ROLE"),
					deployer
				)
			).to.be.false;
			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("DEPOSITOR_ROLE"),
					dailyCopUser1
				)
			).to.be.false;
			// MINTER_ROLE
			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("MINTER_ROLE"),
					minter
				)
			).to.be.true;
			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("MINTER_ROLE"),
					deployer
				)
			).to.be.false;
			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("MINTER_ROLE"),
					dailyCopUser1
				)
			).to.be.false;
		});
	});

	describe("access control", () => {
		it("should make the default admin able to revoke a minter", async () => {
			await dailyCopTokenChildContract
				.connect(defaultAdminSigner)
				.revokeRole(ethers.utils.id("MINTER_ROLE"), minter);

			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("MINTER_ROLE"),
					minter
				)
			).to.be.false;
		});

		it("should make the default admin able to grant a minter role", async () => {
			await dailyCopTokenChildContract
				.connect(defaultAdminSigner)
				.grantRole(ethers.utils.id("MINTER_ROLE"), dailyCopUser1);

			expect(
				await dailyCopTokenChildContract.hasRole(
					ethers.utils.id("MINTER_ROLE"),
					dailyCopUser1
				)
			).to.be.true;
		});
	});

	describe("mint", () => {
		it("should not be able to mint without the MINTER_ROLE", async () => {
			await expectRevert(
				dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.mint(dailyCopUser1, ethers.utils.parseEther("1")),
				"VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
					dailyCopUser1.toLowerCase() +
					" is missing role " +
					ethers.utils.id("MINTER_ROLE") +
					"'"
			);
		});

		it("should not be able to mint to the zero address", async () => {
			await expectRevert(
				dailyCopTokenChildContract
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
				const balanceBefore = await dailyCopTokenChildContract.balanceOf(
					dailyCopUser1
				);
				// When
				await dailyCopTokenChildContract
					.connect(minterSigner)
					.mint(dailyCopUser1, amount);
				// Then
				const balanceAfter = await dailyCopTokenChildContract.balanceOf(
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
				const totalSupplyBefore =
					await dailyCopTokenChildContract.totalSupply();
				// When
				await dailyCopTokenChildContract
					.connect(minterSigner)
					.mint(dailyCopUser1, amount);
				// Then
				const totalSupplyAfter = await dailyCopTokenChildContract.totalSupply();
				const expectedtotalSupplyAfter = totalSupplyBefore.add(amount);
				expect(totalSupplyAfter).to.be.equal(expectedtotalSupplyAfter);
			}
		});

		it("should emit a Transfer event", async () => {
			const amount = ethers.utils.parseEther("99999999");
			await expect(
				dailyCopTokenChildContract
					.connect(minterSigner)
					.mint(dailyCopUser1, amount)
			)
				.to.emit(dailyCopTokenChildContract, "Transfer")
				.withArgs(constants.ZERO_ADDRESS, dailyCopUser1, amount);
		});
	});

	describe("transfer", () => {
		const mintedAmount = ethers.utils.parseEther("99999999");

		beforeEach(async () => {
			// Mint some tokens that can be transfered in the tests
			await dailyCopTokenChildContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);
		});

		it("should mitigate accidental token loss by rejecting the contract's address as a recipient", async () => {
			await expectRevert(
				dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.transfer(dailyCopTokenChildContract.address, mintedAmount),
				"Address can not be the token contract's address"
			);
		});
	});

	describe("transferFrom", () => {
		const mintedAmount = ethers.utils.parseEther("99999999");
		const approvedAmount = ethers.utils.parseEther("10000000");

		beforeEach(async () => {
			// Mint some tokens that can be transfered in the tests
			await dailyCopTokenChildContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);
			await dailyCopTokenChildContract
				.connect(dailyCopUser1Signer)
				.approve(relayer, approvedAmount);
		});

		it("should mitigate accidental token loss by rejecting the contract's address as a recipient", async () => {
			await expectRevert(
				dailyCopTokenChildContract
					.connect(relayerSigner)
					.transferFrom(
						dailyCopUser1,
						dailyCopTokenChildContract.address,
						approvedAmount
					),
				"Address can not be the token contract's address"
			);
		});
	});

	describe("burnFrom", () => {
		const mintedAmount = ethers.utils.parseEther("99999999");
		const approvedAmount = ethers.utils.parseEther("10000000");

		beforeEach(async () => {
			// Mint and approve some tokens that can be burned in the tests
			await dailyCopTokenChildContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);
			await dailyCopTokenChildContract
				.connect(dailyCopUser1Signer)
				.approve(burner, approvedAmount);
		});

		it("should not be able to burn without allowance", async () => {
			const amount = approvedAmount.add(1);
			await expectRevert(
				dailyCopTokenChildContract
					.connect(burnerSigner)
					.burnFrom(dailyCopUser1, amount),
				"ERC20: burn amount exceeds allowance"
			);
		});

		it("should not be able to burn amount exceeding the balance", async () => {
			const amount = mintedAmount.add(1);
			await dailyCopTokenChildContract
				.connect(dailyCopUser1Signer)
				.approve(burner, amount);
			await expectRevert(
				dailyCopTokenChildContract
					.connect(burnerSigner)
					.burnFrom(dailyCopUser1, amount),
				"ERC20: burn amount exceeds balance"
			);
		});

		it("should decrement the allowance with the burned amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("150"),
				ethers.utils.parseEther("200000"),
			];

			for await (const amount of testAmounts) {
				const allowanceBefore = await dailyCopTokenChildContract.allowance(
					dailyCopUser1,
					burner
				);
				await dailyCopTokenChildContract
					.connect(burnerSigner)
					.burnFrom(dailyCopUser1, amount);
				const allowanceAfter = await dailyCopTokenChildContract.allowance(
					dailyCopUser1,
					burner
				);
				const expectedAllowanceAfter = allowanceBefore.sub(amount);
				expect(allowanceAfter).to.be.equal(expectedAllowanceAfter);
			}
		});

		it("should decrement the balance with the burned amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("555555"),
				ethers.utils.parseEther("68799"),
				ethers.utils.parseEther("712365"),
			];

			for await (const amount of testAmounts) {
				const balanceBefore = await dailyCopTokenChildContract.balanceOf(
					dailyCopUser1
				);
				await dailyCopTokenChildContract
					.connect(burnerSigner)
					.burnFrom(dailyCopUser1, amount);
				const balanceAfter = await dailyCopTokenChildContract.balanceOf(
					dailyCopUser1
				);
				const expectedBalanceAfter = balanceBefore.sub(amount);
				expect(balanceAfter).to.be.equal(expectedBalanceAfter);
			}
		});

		it("should decrement the total supply with the burned amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("555555"),
				ethers.utils.parseEther("68799"),
				ethers.utils.parseEther("712365"),
			];

			for await (const amount of testAmounts) {
				const totalSupplyBefore =
					await dailyCopTokenChildContract.totalSupply();
				await dailyCopTokenChildContract
					.connect(burnerSigner)
					.burnFrom(dailyCopUser1, amount);
				const totalSupplyAfter = await dailyCopTokenChildContract.totalSupply();
				const expectedtotalSupplyAfter = totalSupplyBefore.sub(amount);
				expect(totalSupplyAfter).to.be.equal(expectedtotalSupplyAfter);
			}
		});

		it("should emit a Transfer event", async () => {
			const amount = ethers.utils.parseEther("20000");
			await expect(
				dailyCopTokenChildContract
					.connect(burnerSigner)
					.burnFrom(dailyCopUser1, amount)
			)
				.to.emit(dailyCopTokenChildContract, "Transfer")
				.withArgs(dailyCopUser1, constants.ZERO_ADDRESS, amount);
		});
	});

	describe("deposit", () => {
		const withdrawnAmount = ethers.utils.parseEther("100000000");

		beforeEach(async () => {
			// Mint and withdraw some tokens that can be deposited again in the tests
			await dailyCopTokenChildContract
				.connect(minterSigner)
				.mint(dailyCopUser1, withdrawnAmount);
			await dailyCopTokenChildContract
				.connect(dailyCopUser1Signer)
				.withdraw(withdrawnAmount);
		});

		it("should not be able to deposit without the DEPOSITOR_ROLE", async () => {
			const depositData = abiCoder.encodeParameter(
				"uint256",
				ethers.utils.parseEther("1000").toString()
			);
			await expectRevert(
				dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.deposit(dailyCopUser1, depositData),
				"VM Exception while processing transaction: reverted with reason string 'AccessControl: account " +
					dailyCopUser1.toLowerCase() +
					" is missing role " +
					ethers.utils.id("DEPOSITOR_ROLE") +
					"'"
			);
		});

		it("should not be able to deposit more than the withdrawn amount", async () => {
			const depositData = abiCoder.encodeParameter(
				"uint256",
				withdrawnAmount.add(1).toString()
			);
			await expectRevert(
				dailyCopTokenChildContract
					.connect(minterSigner)
					.deposit(dailyCopUser1, depositData),
				"reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
			);
		});

		it("should not be able to deposit to the zero address", async () => {
			const depositData = abiCoder.encodeParameter(
				"uint256",
				ethers.utils.parseEther("1000").toString()
			);
			await expectRevert(
				dailyCopTokenChildContract
					.connect(minterSigner)
					.deposit(constants.ZERO_ADDRESS, depositData),
				"ERC20: mint to the zero address"
			);
		});

		it("should increment the balance of the receiving address with the deposited amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("1"),
				ethers.utils.parseEther("2"),
			];

			for await (const amount of testAmounts) {
				// Given
				const balanceBefore = await dailyCopTokenChildContract.balanceOf(
					dailyCopUser1
				);
				// When
				await dailyCopTokenChildContract
					.connect(minterSigner)
					.deposit(
						dailyCopUser1,
						abiCoder.encodeParameter("uint256", amount.toString())
					);
				// Then
				const balanceAfter = await dailyCopTokenChildContract.balanceOf(
					dailyCopUser1
				);
				const expectedBalanceAfter = balanceBefore.add(amount);
				expect(balanceAfter).to.be.equal(expectedBalanceAfter);
			}
		});

		it("should increment the total token supply with the deposited amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("1"),
				ethers.utils.parseEther("2"),
			];

			for await (const amount of testAmounts) {
				// Given
				const totalSupplyBefore =
					await dailyCopTokenChildContract.totalSupply();
				// When
				await dailyCopTokenChildContract
					.connect(minterSigner)
					.deposit(
						dailyCopUser1,
						abiCoder.encodeParameter("uint256", amount.toString())
					);
				// Then
				const totalSupplyAfter = await dailyCopTokenChildContract.totalSupply();
				const expectedtotalSupplyAfter = totalSupplyBefore.add(amount);
				expect(totalSupplyAfter).to.be.equal(expectedtotalSupplyAfter);
			}
		});

		it("should have decremented the token supply on layer 1 with the deposited amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("1"),
				ethers.utils.parseEther("2"),
			];

			for await (const amount of testAmounts) {
				// Given
				const layer1SupplyBefore =
					await dailyCopTokenChildContract.layer1Supply();
				// When
				await dailyCopTokenChildContract
					.connect(minterSigner)
					.deposit(
						dailyCopUser1,
						abiCoder.encodeParameter("uint256", amount.toString())
					);
				// Then
				const layer1SupplyAfter =
					await dailyCopTokenChildContract.layer1Supply();
				const expectedLayer1SupplyAfter = layer1SupplyBefore.sub(amount);
				expect(layer1SupplyAfter).to.be.equal(expectedLayer1SupplyAfter);
			}
		});

		it("should emit a Transfer event", async () => {
			const amount = ethers.utils.parseEther("99999999");
			await expect(
				dailyCopTokenChildContract
					.connect(minterSigner)
					.deposit(
						dailyCopUser1,
						abiCoder.encodeParameter("uint256", amount.toString())
					)
			)
				.to.emit(dailyCopTokenChildContract, "Transfer")
				.withArgs(constants.ZERO_ADDRESS, dailyCopUser1, amount);
		});
	});

	describe("withdraw", () => {
		const mintedAmount = ethers.utils.parseEther("99999999");

		beforeEach(async () => {
			// Mint some tokens that can be withdrawn in the tests
			await dailyCopTokenChildContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);
		});

		it("should not be able to withdraw amount exceeding the balance", async () => {
			const amount = mintedAmount.add(1);
			await expectRevert(
				dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.withdraw(amount),
				"ERC20: burn amount exceeds balance"
			);
		});

		it("should decrement the balance with the withdrawn amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("555555"),
				ethers.utils.parseEther("68799"),
				ethers.utils.parseEther("712365"),
			];

			for await (const amount of testAmounts) {
				const balanceBefore = await dailyCopTokenChildContract.balanceOf(
					dailyCopUser1
				);
				await dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.withdraw(amount);
				const balanceAfter = await dailyCopTokenChildContract.balanceOf(
					dailyCopUser1
				);
				const expectedBalanceAfter = balanceBefore.sub(amount);
				expect(balanceAfter).to.be.equal(expectedBalanceAfter);
			}
		});

		it("should decrement the total supply with the withdrawn amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("555555"),
				ethers.utils.parseEther("68799"),
				ethers.utils.parseEther("712365"),
			];

			for await (const amount of testAmounts) {
				const totalSupplyBefore =
					await dailyCopTokenChildContract.totalSupply();
				await dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.withdraw(amount);
				const totalSupplyAfter = await dailyCopTokenChildContract.totalSupply();
				const expectedtotalSupplyAfter = totalSupplyBefore.sub(amount);
				expect(totalSupplyAfter).to.be.equal(expectedtotalSupplyAfter);
			}
		});

		it("should increment the token supply on layer 1 with the withdrawn amount", async () => {
			const testAmounts = [
				ethers.utils.parseEther("1"),
				ethers.utils.parseEther("2"),
			];

			for await (const amount of testAmounts) {
				// Given
				const layer1SupplyBefore =
					await dailyCopTokenChildContract.layer1Supply();
				// When
				await dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.withdraw(amount);
				// Then
				const layer1SupplyAfter =
					await dailyCopTokenChildContract.layer1Supply();
				const expectedLayer1SupplyAfter = layer1SupplyBefore.add(amount);
				expect(layer1SupplyAfter).to.be.equal(expectedLayer1SupplyAfter);
			}
		});

		it("should emit a Transfer event", async () => {
			const amount = ethers.utils.parseEther("20000");
			await expect(
				dailyCopTokenChildContract.connect(dailyCopUser1Signer).withdraw(amount)
			)
				.to.emit(dailyCopTokenChildContract, "Transfer")
				.withArgs(dailyCopUser1, constants.ZERO_ADDRESS, amount);
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
			await dailyCopTokenChildContract
				.connect(minterSigner)
				.mint(dailyCopUser1, mintedAmount);

			// Create valid permit data that can be used in the tests
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
				dailyCopTokenChildContract
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
			await dailyCopTokenChildContract
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
				dailyCopTokenChildContract
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
			const allowanceBefore = await dailyCopTokenChildContract.allowance(
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

			await dailyCopTokenChildContract
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

			const allowanceAfter = await dailyCopTokenChildContract.allowance(
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
				dailyCopTokenChildContract
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
				.to.emit(dailyCopTokenChildContract, "Approval")
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
				.mint(dailyCopTokenChildContract.address, mintedAmount);
		});

		it("can not be done by anyone else than the default admin", async () => {
			await expectRevert(
				dailyCopTokenChildContract
					.connect(dailyCopUser1Signer)
					.transferAnyERC20(
						mockERC20Contract.address,
						dailyCopUser1,
						mintedAmount
					),
				`AccessControl: account ${dailyCopUser1.toLowerCase()} is missing role ${await dailyCopTokenChildContract.DEFAULT_ADMIN_ROLE()}`
			);
		});

		it("should transfer any ERC20 token that the contract holds to a recipient", async () => {
			const contractBalanceBefore = await mockERC20Contract.balanceOf(
				dailyCopTokenChildContract.address
			);
			const recipientBalanceBefore = await mockERC20Contract.balanceOf(
				dailyCopUser1
			);

			dailyCopTokenChildContract
				.connect(defaultAdminSigner)
				.transferAnyERC20(
					mockERC20Contract.address,
					dailyCopUser1,
					mintedAmount
				);

			const contractBalanceAfter = await mockERC20Contract.balanceOf(
				dailyCopTokenChildContract.address
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
