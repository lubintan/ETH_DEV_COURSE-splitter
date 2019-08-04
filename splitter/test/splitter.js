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

		return expectedExceptionPromise(() =>{
			return splitterContract.split(bob,carol,{from:alice,value:amountToSend});
			});
	});


	it ("Rejects withdrawal of 0 balance.", () => {
		let amountToSend = bigNum(0);

		return expectedExceptionPromise(() =>{
			return splitterContract.withdrawal({from:bob});
			});
	});

	it ("Cannot withdraw when contract paused.", () =>{
		let amountToSend = bigNum(5e8);
		return expectedExceptionPromise(() =>{
				return splitterContract.split(bob,carol,{from:alice,value:amountToSend})
				.then(() => {
					return splitterContract.pause({from:alice});
				}).then(() => {
					return splitterContract.withdrawal({from:bob});
				})	
			});
	});

	it ("Cannot split when contract paused.", () =>{
		let amountToSend = bigNum(5e8);
		return expectedExceptionPromise(() =>{
			return splitterContract.pause({from:alice})
			.then(() => {
				return splitterContract.split(bob,carol,{from:alice,value:amountToSend});
			})
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
		let bobAmount = bigNum(5e8).div(bigNum(2));
		let carolAmount = bobAmount.add(bigNum(1));

		return splitterContract.split(bob,carol, {from:alice, value:amountToSend})
		.then(() => {
			return Promise.all([splitterContract.balances.call(bob),splitterContract.balances.call(carol)]);
		}).then((contractBalances) => {
			bobBalance = bigNum(contractBalances[0]);
			carolBalance = bigNum(contractBalances[1]);
			
			assert.strictEqual(bobBalance.toString(10),bobAmount.toString(10),"Bob's contract balance incorrect.");
			assert.strictEqual(carolBalance.toString(10),carolAmount.toString(10),"Carol's contract balance incorrect.");
		})
	});

	it("Withdrawal works correctly.", function(){
		let bobInitial, carolInitial, bobContract, carolContract;
		let amountToSend = bigNum(5e8).add(bigNum(1));
		let bobGasUsed, carolGasUsed, bobGasCost, carolGasCost;
		return Promise.all([web3.eth.getBalance(bob), web3.eth.getBalance(carol)])
		.then((initalBal) => {
			bobInitial = bigNum(initalBal[0]);
			carolInitial = bigNum(initalBal[1]);

			return splitterContract.split(bob, carol, {from:alice, value: amountToSend});
		}).then(() => {
			return Promise.all([splitterContract.balances.call(bob), splitterContract.balances.call(carol)]);
		}).then((contractBal) => {
			bobContract = bigNum(contractBal[0]);
			carolContract = bigNum(contractBal[1]);

			return Promise.all([splitterContract.withdrawal({from:bob}), splitterContract.withdrawal({from:carol})]);
		}).then( (txes) => {
			bobGasUsed = bigNum(txes[0].receipt.gasUsed);
			carolGasUsed = bigNum(txes[1].receipt.gasUsed);

			return Promise.all([web3.eth.getTransaction(txes[0].tx), web3.eth.getTransaction(txes[1].tx)]);
		}).then( (txes) => {
			let bobGasPrice = bigNum(txes[0].gasPrice);
			let carolGasPrice = bigNum(txes[1].gasPrice);
		
			bobGasCost = bobGasPrice.mul(bobGasUsed);
			carolGasCost = carolGasPrice.mul(carolGasUsed);
		
			return Promise.all([web3.eth.getBalance(bob), web3.eth.getBalance(carol)]);
		}).then((finalBal) => {
			let finalBob = bigNum(finalBal[0]);
			let finalCarol = bigNum(finalBal[1]);

			assert.strictEqual(finalBob.toString(10), bobInitial.add(bobContract).sub(bobGasCost).toString(10), "Bob's final balance incorrect.");
			assert.strictEqual(finalCarol.toString(10), carolInitial.add(carolContract).sub(carolGasCost).toString(10), "Carol's final balance incorrect.");

			return Promise.all([splitterContract.balances.call(bob), splitterContract.balances.call(carol)]);
		}).then((finalContBal) => {
			let finalContBob = bigNum(finalContBal[0]);
			let finalContCarol = bigNum(finalContBal[1]);

			assert.strictEqual(finalContBob.toString(10), bigNum(0).toString(10), "Bob's contract balance not 0 after withdrawal.")
			assert.strictEqual(finalContCarol.toString(10), bigNum(0).toString(10), "Carol's contract balance not 0 after withdrawal.")
		})
	});

})