const truffleAssert = require('truffle-assertions');
var Splitter = artifacts.require("./Splitter.sol");
var bigNum = web3.utils.toBN;

contract('Splitter', function(accounts){
	
	const [alice,bob,carol] = accounts;
	var splitterContract;

	beforeEach( async () => {
		let instance = await Splitter.new({from:alice});
		splitterContract = instance;
	});

	/*
	The following checks are done based on the assumption that none of these accounts are mining,
	or have ether being credited to their balances while this test is being run.
	Expected balances are calculated based on the effects of the Splitter contract, and the 
	associated gas costs.
	*/

	it ("Rejects 0 value split.", async () => {
		let amountToSend = bigNum(0);
		await truffleAssert.reverts(splitterContract.split(bob,carol,{from:alice,value:amountToSend}))
	});


	it ("Rejects withdrawal of 0 balance.", async () => {
		await truffleAssert.reverts(splitterContract.withdrawal({from:bob}));
	});

	it ("Cannot withdraw when contract paused.", async () =>{
		let amountToSend = bigNum(5e8);
		await splitterContract.split(bob,carol,{from:alice,value:amountToSend});
		await splitterContract.pause({from:alice});
		await truffleAssert.reverts(splitterContract.withdrawal({from:bob}));
	});

	it ("Cannot split when contract paused.", async () =>{
		let amountToSend = bigNum(5e8);
		await splitterContract.pause({from:alice});
		await truffleAssert.reverts(splitterContract.split(bob,carol,{from:alice,value:amountToSend}));
	});

	it("Splits even amount correctly.", async () => {
		let amountToSend = bigNum(5e8);
		let halfAmount = amountToSend.div(bigNum(2));
		
		let split = await splitterContract.split(bob,carol, {from:alice, value:amountToSend});
		await truffleAssert.eventEmitted(split,'LogSplit');

		let contractBalances = await Promise.all([splitterContract.balances.call(bob),splitterContract.balances.call(carol)]);

		assert.strictEqual(contractBalances[0].toString(10),halfAmount.toString(10),"Bob's contract balance incorrect.");
		assert.strictEqual(contractBalances[1].toString(10),halfAmount.toString(10),"Carol's contract balance incorrect.");

	});

	it("Splits odd amount correctly.", async () => {
		let amountToSend = bigNum(5e8).add(bigNum(1));
		let splitAmount = bigNum(5e8).div(bigNum(2));
		
		let split = await splitterContract.split(bob,carol, {from:alice, value:amountToSend});
		await truffleAssert.eventEmitted(split,'LogSplit');

		let contractBalances = await Promise.all([
				splitterContract.balances.call(alice),
				splitterContract.balances.call(bob),
				splitterContract.balances.call(carol)
			]);
		
		assert.strictEqual(contractBalances[0].toString(10),bigNum(1).toString(10),"Alice's contract balance incorrect.");
		assert.strictEqual(contractBalances[1].toString(10),splitAmount.toString(10),"Bob's contract balance incorrect.");
		assert.strictEqual(contractBalances[2].toString(10),splitAmount.toString(10),"Carol's contract balance incorrect.");
		await console.log("went through");

	});

	it("Withdrawal works correctly.", async() => {
		let aliceInitial, bobInitial, carolInitial;
		let amountToSend = bigNum(5e8).add(bigNum(1));
		let splitAmount = bigNum(5e8).div(bigNum(2));
		let bobGasUsed, carolGasUsed, bobGasCost, carolGasCost;
		
		let split = await splitterContract.split(bob, carol, {from:alice, value: amountToSend});
		await truffleAssert.eventEmitted(split,'LogSplit');

		let initialBal = await Promise.all([
			web3.eth.getBalance(alice),
			web3.eth.getBalance(bob),
			web3.eth.getBalance(carol)
		]);

		aliceInitial = bigNum(initialBal[0]);
		bobInitial = bigNum(initialBal[1]);
		carolInitial = bigNum(initialBal[2]);

		let txes = await Promise.all([
			splitterContract.withdrawal({from:alice}), 
			splitterContract.withdrawal({from:bob}), 
			splitterContract.withdrawal({from:carol})
		]);

		await truffleAssert.eventEmitted(txes[2],'LogWithdrawal');
		// await truffleAssert.prettyPrintEmittedEvents(txes[2]);

		aliceGasUsed = bigNum(txes[0].receipt.gasUsed);
		bobGasUsed = bigNum(txes[1].receipt.gasUsed);
		carolGasUsed = bigNum(txes[2].receipt.gasUsed);

		txes = await Promise.all([
			web3.eth.getTransaction(txes[0].tx),
			web3.eth.getTransaction(txes[1].tx), 
			web3.eth.getTransaction(txes[2].tx)
		]);
		let aliceGasPrice = bigNum(txes[0].gasPrice); 
		let bobGasPrice = bigNum(txes[1].gasPrice);
		let carolGasPrice = bigNum(txes[2].gasPrice);
	
		aliceGasCost = aliceGasPrice.mul(aliceGasUsed);
		bobGasCost = bobGasPrice.mul(bobGasUsed);
		carolGasCost = carolGasPrice.mul(carolGasUsed);
	
		let finalBal = await Promise.all([
			web3.eth.getBalance(alice),
			web3.eth.getBalance(bob),
			web3.eth.getBalance(carol)
		]);
		let finalAlice = bigNum(finalBal[0]);
		let finalBob = bigNum(finalBal[1]);
		let finalCarol = bigNum(finalBal[2]);
		
		assert.strictEqual(finalAlice.toString(10), aliceInitial.add(bigNum(1)).sub(aliceGasCost).toString(10), "Alice's final balance incorrect.");
		assert.strictEqual(finalBob.toString(10), bobInitial.add(splitAmount).sub(bobGasCost).toString(10), "Bob's final balance incorrect.");
		assert.strictEqual(finalCarol.toString(10), carolInitial.add(splitAmount).sub(carolGasCost).toString(10), "Carol's final balance incorrect.");

		let finalContBal = await Promise.all([
			splitterContract.balances.call(alice), 
			splitterContract.balances.call(bob), 
			splitterContract.balances.call(carol)
		]);

		let finalContAlice = bigNum(finalContBal[0]);
		let finalContBob = bigNum(finalContBal[1]);
		let finalContCarol = bigNum(finalContBal[2]);

		assert.strictEqual(finalContAlice.toString(10), bigNum(0).toString(10), "Alice's contract balance not 0 after withdrawal.")
		assert.strictEqual(finalContBob.toString(10), bigNum(0).toString(10), "Bob's contract balance not 0 after withdrawal.")
		assert.strictEqual(finalContCarol.toString(10), bigNum(0).toString(10), "Carol's contract balance not 0 after withdrawal.")

		await console.log("went through");

	});

})