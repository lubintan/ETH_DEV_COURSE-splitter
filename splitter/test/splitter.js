const truffleAssert = require('truffle-assertions');
const Splitter = artifacts.require("./Splitter.sol");
const bigNum = web3.utils.toBN;
const seqPrm = require("./sequentialPromise.js");

contract('Splitter', function(accounts){
	
	const [alice,bob,carol] = accounts;
	let splitterContract;

	beforeEach( async () => {
		splitterContract = await Splitter.new({ from:alice });
	});

	/*
	The following checks are done based on the assumption that none of these accounts are mining,
	or have ether being credited to their balances while this test is being run.
	Expected balances are calculated based on the effects of the Splitter contract, and the 
	associated gas costs.
	*/

	it ("Rejects 0 value split.", async () => {
		const amountToSend = bigNum(0);
		await truffleAssert.reverts(splitterContract.split(bob,carol,{ from:alice, value:amountToSend }))
	});

	it ("Rejects withdrawal of 0 balance.", async () => {
		await truffleAssert.reverts(splitterContract.withdrawal({ from:bob }));
	});

	it ("Cannot withdraw when contract paused.", async () =>{
		const amountToSend = bigNum(5e8);
		await splitterContract.split(bob,carol,{ from:alice, value:amountToSend });
		await splitterContract.pause({ from:alice});
		await truffleAssert.reverts(splitterContract.withdrawal({ from:bob }));
	});

	it ("Cannot split when contract paused.", async () =>{
		const amountToSend = bigNum(5e8);
		await splitterContract.pause({ from:alice});
		await truffleAssert.reverts(splitterContract.split(bob,carol,{ from:alice, value:amountToSend }));
	});

	it("Splits even amount correctly.", async () => {
		const amountToSend = bigNum(5e8);
		const halfAmount = amountToSend.div(bigNum(2));
		
		const split = await splitterContract.split(bob,carol, { from:alice, value:amountToSend });
		await truffleAssert.eventEmitted(split, 'LogSplit');

		const contractBalances = await seqPrm([
			() => splitterContract.balances.call(bob), 
			() => splitterContract.balances.call(carol)
		]);

		assert.strictEqual(contractBalances[0].toString(10),halfAmount.toString(10), "Bob's contract balance incorrect.");
		assert.strictEqual(contractBalances[1].toString(10),halfAmount.toString(10), "Carol's contract balance incorrect.");

	});

	it("Splits odd amount correctly.", async () => {
		const amountToSend = bigNum(5e8).add(bigNum(1));
		const splitAmount = bigNum(5e8).div(bigNum(2));
		
		const split = await splitterContract.split(bob,carol, { from:alice, value:amountToSend });
		await truffleAssert.eventEmitted(split, 'LogSplit');

		const contractBalances = await seqPrm([
				() => splitterContract.balances.call(alice),
				() => splitterContract.balances.call(bob),
				() => splitterContract.balances.call(carol)
			]);
		
		assert.strictEqual(contractBalances[0].toString(10),bigNum(1).toString(10), "Alice's contract balance incorrect.");
		assert.strictEqual(contractBalances[1].toString(10),splitAmount.toString(10), "Bob's contract balance incorrect.");
		assert.strictEqual(contractBalances[2].toString(10),splitAmount.toString(10), "Carol's contract balance incorrect.");
	});

	it("Withdrawal works correctly.", async() => {
		const amountToSend = bigNum(5e8).add(bigNum(1));
		const splitAmount = bigNum(5e8).div(bigNum(2));
		
		const split = await splitterContract.split(bob, carol, { from:alice, value: amountToSend });
		await truffleAssert.eventEmitted(split, 'LogSplit');

		const initialBal = await seqPrm([
			() => web3.eth.getBalance(alice),
			() => web3.eth.getBalance(bob),
		]);

		const aliceInitial = bigNum(initialBal[0]);
		const bobInitial = bigNum(initialBal[1]);

		let txes = await seqPrm([
			() => splitterContract.withdrawal({ from:alice }), 
			() => splitterContract.withdrawal({ from:bob }), 
		]);

		await truffleAssert.eventEmitted(txes[1], 'LogWithdrawal');
		// await truffleAssert.prettyPrintEmittedEvents(txes[2]);

		const aliceGasUsed = bigNum(txes[0].receipt.gasUsed);
		const bobGasUsed = bigNum(txes[1].receipt.gasUsed);

		txes = await seqPrm([
			() => web3.eth.getTransaction(txes[0].tx),
			() => web3.eth.getTransaction(txes[1].tx), 
		]);
		const aliceGasPrice = bigNum(txes[0].gasPrice); 
		const bobGasPrice = bigNum(txes[1].gasPrice);
	
		const aliceGasCost = aliceGasPrice.mul(aliceGasUsed);
		const bobGasCost = bobGasPrice.mul(bobGasUsed);
	
		const finalBal = await seqPrm([
			() => web3.eth.getBalance(alice),
			() => web3.eth.getBalance(bob),
		]);
		const finalAlice = bigNum(finalBal[0]);
		const finalBob = bigNum(finalBal[1]);
		
		assert.strictEqual(finalAlice.toString(10), aliceInitial.add(bigNum(1)).sub(aliceGasCost).toString(10), "Alice's final balance incorrect.");
		assert.strictEqual(finalBob.toString(10), bobInitial.add(splitAmount).sub(bobGasCost).toString(10), "Bob's final balance incorrect.");

		const finalContBal = await seqPrm([
			() => splitterContract.balances.call(alice), 
			() => splitterContract.balances.call(bob), 
		]);

		const finalContAlice = bigNum(finalContBal[0]);
		const finalContBob = bigNum(finalContBal[1]);

		assert.strictEqual(finalContAlice.toString(10), bigNum(0).toString(10), "Alice's contract balance not 0 after withdrawal.")
		assert.strictEqual(finalContBob.toString(10), bigNum(0).toString(10), "Bob's contract balance not 0 after withdrawal.")
	});

})