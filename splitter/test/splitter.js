var Splitter = artifacts.require("./Splitter.sol");
const expectedExceptionPromise = require("./expected_exception_testRPC_and_geth.js");
var bigNum = web3.utils.toBN;

contract('Splitter', function(accounts){
	
	const [alice,bob,carol] = accounts;
	var splitterContract;

	beforeEach( function() {
		return Splitter.new({from:alice})
		.then(function(instance){
			splitterContract = instance;
		});
	});

	/*
	The following checks are done based on the assumption that none of these accounts are mining,
	or have ether being credited to their balances while this test is being run.
	Expected balances are calculated based on the effects of the Splitter contract, and the 
	associated gas costs.
	*/

	it ("Rejects 0 value split.", () => {
		let amountToSend = bigNum(0);

		return expectedExceptionPromise(() =>
			splitterContract.split(bob,carol,{from:alice,value:amountToSend})
		);
	});


	it ("Rejects withdrawal of 0 balance.", () => {
		return expectedExceptionPromise(() =>
			splitterContract.withdrawal({from:bob})
		);
	});

	it ("Cannot withdraw when contract paused.", () =>{
		let amountToSend = bigNum(5e8);
		
		return splitterContract.split(bob,carol,{from:alice,value:amountToSend})
			.then(() => {
				return splitterContract.pause({from:alice});
			}).then(() => {
				return expectedExceptionPromise(() =>
					splitterContract.withdrawal({from:bob})
			);	
		});
	});

	it ("Cannot split when contract paused.", () =>{
		let amountToSend = bigNum(5e8);
		return splitterContract.pause({from:alice})
		.then(() => {
			return expectedExceptionPromise(() => 
				splitterContract.split(bob,carol,{from:alice,value:amountToSend})
			);		
		});
	});

	it("Splits even amount correctly.", function(){
		let amountToSend = bigNum(5e8);
		let halfAmount = amountToSend.div(bigNum(2));
		
		return splitterContract.split(bob,carol, {from:alice, value:amountToSend})
		.then(() => {
			return Promise.all([splitterContract.balances.call(bob),splitterContract.balances.call(carol)]);
		}).then((contractBalances) => {
			bobBalance = bigNum(contractBalances[0]);
			carolBalance = bigNum(contractBalances[1]);
			
			assert.strictEqual(bobBalance.toString(10),halfAmount.toString(10),"Bob's contract balance incorrect.");
			assert.strictEqual(carolBalance.toString(10),halfAmount.toString(10),"Carol's contract balance incorrect.");
		})
	});

	it("Splits odd amount correctly.", function(){
		let amountToSend = bigNum(5e8).add(bigNum(1));
		let splitAmount = bigNum(5e8).div(bigNum(2));
		
		return splitterContract.split(bob,carol, {from:alice, value:amountToSend})
		.then(() => {
			return Promise.all([
				splitterContract.balances.call(alice),
				splitterContract.balances.call(bob),
				splitterContract.balances.call(carol)
			]);
		}).then((contractBalances) => {
			aliceBalance = bigNum(contractBalances[0]);
			bobBalance = bigNum(contractBalances[1]);
			carolBalance = bigNum(contractBalances[2]);
			
			assert.strictEqual(aliceBalance.toString(10),bigNum(1).toString(10),"Alice's contract balance incorrect.");
			assert.strictEqual(bobBalance.toString(10),splitAmount.toString(10),"Bob's contract balance incorrect.");
			assert.strictEqual(carolBalance.toString(10),splitAmount.toString(10),"Carol's contract balance incorrect.");
		})
	});

	it("Withdrawal works correctly.", function(){
		let aliceInitial, bobInitial, carolInitial;
		let amountToSend = bigNum(5e8).add(bigNum(1));
		let splitAmount = bigNum(5e8).div(bigNum(2));
		let bobGasUsed, carolGasUsed, bobGasCost, carolGasCost;
		
		return splitterContract.split(bob, carol, {from:alice, value: amountToSend})
		.then(() => {
			return Promise.all([
				web3.eth.getBalance(alice),
				web3.eth.getBalance(bob),
				web3.eth.getBalance(carol)
			]);
		}).then((initialBal) => {
			aliceInitial = bigNum(initialBal[0]);
			bobInitial = bigNum(initialBal[1]);
			carolInitial = bigNum(initialBal[2]);

			return Promise.all([
				splitterContract.withdrawal({from:alice}), 
				splitterContract.withdrawal({from:bob}), 
				splitterContract.withdrawal({from:carol})
			]);
		}).then( (txes) => {
			aliceGasUsed = bigNum(txes[0].receipt.gasUsed);
			bobGasUsed = bigNum(txes[1].receipt.gasUsed);
			carolGasUsed = bigNum(txes[2].receipt.gasUsed);

			return Promise.all([
				web3.eth.getTransaction(txes[0].tx),
				web3.eth.getTransaction(txes[1].tx), 
				web3.eth.getTransaction(txes[2].tx)
			]);
		}).then( (txes) => {
			let aliceGasPrice = bigNum(txes[0].gasPrice); 
			let bobGasPrice = bigNum(txes[1].gasPrice);
			let carolGasPrice = bigNum(txes[2].gasPrice);
		
			aliceGasCost = aliceGasPrice.mul(aliceGasUsed);
			bobGasCost = bobGasPrice.mul(bobGasUsed);
			carolGasCost = carolGasPrice.mul(carolGasUsed);
		
			return Promise.all([
				web3.eth.getBalance(alice),
				web3.eth.getBalance(bob),
				web3.eth.getBalance(carol)
			]);
		}).then((finalBal) => {
			let finalAlice = bigNum(finalBal[0]);
			let finalBob = bigNum(finalBal[1]);
			let finalCarol = bigNum(finalBal[2]);
			
			assert.strictEqual(finalAlice.toString(10), aliceInitial.add(bigNum(1)).sub(aliceGasCost).toString(10), "Alice's final balance incorrect.");
			assert.strictEqual(finalBob.toString(10), bobInitial.add(splitAmount).sub(bobGasCost).toString(10), "Bob's final balance incorrect.");
			assert.strictEqual(finalCarol.toString(10), carolInitial.add(splitAmount).sub(carolGasCost).toString(10), "Carol's final balance incorrect.");

			return Promise.all([
				splitterContract.balances.call(alice), 
				splitterContract.balances.call(bob), 
				splitterContract.balances.call(carol)
			]);
		}).then((finalContBal) => {
			let finalContAlice = bigNum(finalContBal[0]);
			let finalContBob = bigNum(finalContBal[1]);
			let finalContCarol = bigNum(finalContBal[2]);

			assert.strictEqual(finalContAlice.toString(10), bigNum(0).toString(10), "Alice's contract balance not 0 after withdrawal.")
			assert.strictEqual(finalContBob.toString(10), bigNum(0).toString(10), "Bob's contract balance not 0 after withdrawal.")
			assert.strictEqual(finalContCarol.toString(10), bigNum(0).toString(10), "Carol's contract balance not 0 after withdrawal.")
		})
	});

})