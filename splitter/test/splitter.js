var Splitter = artifacts.require("./Splitter.sol");
const expectedExceptionPromise = require("./expected_exception_testRPC_and_geth.js");
var bigNum = web3.utils.toBN;

contract('Splitter', function(accounts){
	

	const alice = accounts[0];
	const bob = accounts[1];
	const carol = accounts[2];
	// const dan = accounts[3];
	// const ella = accounts[4]

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

	it("splits correctly", function(){

		var amountToSend = bigNum(5454545454);
		
		var halfAmount = amountToSend.div(bigNum(2));
		var mainTx, gasUsed, gasPrice, gasCost;
		var newBalanceAlice, newBalanceBob, newBalanceCarol;
		var balanceAlice, balanceBob, balanceCarol;
		var txBob, txInfoBob, gasUsedBob, gasPriceBob, gasCostBob;
		var txCarol, txInfoCarol, gasUsedCarol, gasPriceCarol, gasCostCarol;
		var expectedBalanceAlice, expectedBalanceBob, expectedBalanceCarol;

		var aliceProm = web3.eth.getBalance(alice);
		var bobProm = web3.eth.getBalance(bob);
		var carolProm = web3.eth.getBalance(carol);		

		var balProm = Promise.all([aliceProm,bobProm,carolProm]);
		
		var resultProm = balProm.then((balances) => {
			balanceAlice = bigNum(balances[0]);
			balanceBob = bigNum(balances[1]);
			balanceCarol = bigNum(balances[2]);
			return splitterContract.split(bob,carol, {from:alice, value:amountToSend});

		}).then((tx) => {
			mainTx = tx;
			return web3.eth.getTransaction(mainTx.tx);

		}).then((txInfo)=>{
			gasUsed = bigNum(mainTx.receipt.gasUsed);
			gasPrice = bigNum(txInfo.gasPrice);
			gasCost = gasPrice.mul(gasUsed);	
			expectedBalanceAlice = balanceAlice.sub(gasCost).sub(amountToSend);
			
			var checkBalProm = Promise.all([splitterContract.balances.call(bob),splitterContract.balances.call(carol)]);
			return checkBalProm;

		}).then((contractBalances) => {
			bobBalance = contractBalances[0];
			carolBalance = contractBalances[1];
			
			assert.strictEqual(bobBalance.toString(10),halfAmount.toString(10),"Bob's contract balance incorrect.");
			assert.strictEqual(carolBalance.toString(10),halfAmount.toString(10),"Carol's contract balance incorrect.");

			var withdrawalProm = Promise.all([splitterContract.withdrawal({from:bob}),splitterContract.withdrawal({from:carol})])
			return withdrawalProm;

		}).then((withdrawTx) => {
			txBob = withdrawTx[0];
			txCarol = withdrawTx[1];

			var txProm = Promise.all([web3.eth.getTransaction(txBob.tx),web3.eth.getTransaction(txCarol.tx)]);
			return txProm;

		}).then((txInfos) => {
			txInfoBob = txInfos[0];
			txInfoCarol = txInfos[1];

			gasUsedBob = bigNum(txBob.receipt.gasUsed); 
			gasPriceBob = bigNum(txInfoBob.gasPrice);
			gasCostBob = gasPriceBob.mul(gasUsedBob);	
			expectedBalanceBob = balanceBob.sub(gasCostBob).add(halfAmount);

			gasUsedCarol = bigNum(txCarol.receipt.gasUsed); 
			gasPriceCarol = bigNum(txInfoCarol.gasPrice);
			gasCostCarol = gasPriceCarol.mul(gasUsedCarol);	
			expectedBalanceCarol = balanceCarol.sub(gasCostCarol).add(halfAmount);

			var balancesProm = Promise.all([web3.eth.getBalance(alice),
											web3.eth.getBalance(bob),
											web3.eth.getBalance(carol),
											splitterContract.balances.call(bob),
											splitterContract.balances.call(carol)]);
			return balancesProm;

		}).then((balances)=>{
			newBalanceAlice = balances[0]; 
			newBalanceBob = balances[1];
			newBalanceCarol = balances[2];
			bobBalance = balances[3];
			carolBalance = balances[4];

			assert.equal(bobBalance.toString(10),0,"Bob contract balance not 0 after withdrawal.");
			assert.equal(carolBalance.toString(10),0,"Carol contract balance not 0 after withdrawal.");
			assert.strictEqual(newBalanceAlice.toString(10), expectedBalanceAlice.toString(10),"Alice balance incorrect.");
			assert.strictEqual(newBalanceBob.toString(10), expectedBalanceBob.toString(10),"Bob balance incorrect.");
			assert.strictEqual(newBalanceCarol.toString(10), expectedBalanceCarol.toString(10),"Carol balance incorrect.");

		})
		.catch((rejected)=>{
			console.error(rejected, 'Lukaku');
			console.error('manunited');

			assert.fail();
		});

		return resultProm;
	});

	it ("rejects 0 value", () => {
		var amountToSend = bigNum(0);

		return expectedExceptionPromise(() =>{
			return splitterContract.split(bob,carol,{from:alice,value:amountToSend});
			});
	});

	it ("rejects odd value", () => {
		var amountToSend = bigNum(5454545455);

		return expectedExceptionPromise(() =>{
			return splitterContract.split(bob,carol,{from:alice,value:amountToSend});
			});
	});

})