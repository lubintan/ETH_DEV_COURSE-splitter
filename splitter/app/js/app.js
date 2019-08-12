const Web3 = require("web3");
const Promise = require("bluebird");
const truffleContract = require("truffle-contract");
const $ = require("jquery");
const splitterJson = require("../../build/contracts/Splitter.json");
const bigNum = Web3.utils.toBN;


// Supports Metamask, and other wallets that provide / inject 'web3'.
if (typeof web3 !== 'undefined') {
    // Use the Mist/wallet/Metamask provider.
    window.web3 = new Web3(web3.currentProvider);
} else {
    // Your preferred fallback.
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545')); 
}

const Splitter = truffleContract(splitterJson);
Splitter.setProvider(web3.currentProvider);

const splitAction = async() => {
    // Sometimes you have to force the gas amount to a value you know is enough because
    // `web3.eth.estimateGas` may get it wrong.
    const gas = 300000; 
    let txId;
    // We simulate the real call and see whether this is likely to work.
    try{
        let deployed = await Splitter.deployed();
        let simResult = await deployed.split.call(
            $("select[id='bob']").val(),
            $("select[id='carol']").val(),
            {
            from: $("select[id='alice']").val(),
            value: bigNum($("input[name='amount']").val()),
            gas:gas
            });
        
        if (await !simResult) {
            throw new Error("The transaction will fail anyway, not sending");
        }
        // Ok, we move onto the proper action.
        await deployed.split(
            $("select[id='bob']").val(),
            $("select[id='carol']").val(),
            {
            from: $("select[id='alice']").val(),
            value: $("input[name='amount']").val(),
            gas:gas
            }
        )
        .on(
            "transactionHash",
            txHash => {
                txId = txHash;
                $("#splitStatus").html("Created Transaction: " + txHash);
            }
        )
        .on(
            "receipt", receipt =>{
                if (!receipt.status) {
                    console.error("Wrong status");
                    console.error(receipt);
                    $("#splitStatus").html("There was an error in the tx execution, status not 1");
                    $("#from").html("NA");
                    $("#to1").html("NA");
                    $("#to2").html("NA");
                    $("#logSplitValue").html("NA");
                } else if (receipt.logs.length == 0) {
                    console.error("Empty logs");
                    console.error(receipt);
                    $("#splitStatus").html("There was an error in the tx execution, missing expected event");
                    $("#from").html("NA");
                    $("#to1").html("NA");
                    $("#to2").html("NA");
                    $("#logSplitValue").html("NA");
                } else {
                    console.log(receipt.logs[0]);
                    $("#splitStatus").html("Transfer executed. Tx ID: " + txId);
                    if (receipt.logs[0].event == "LogSplit"){
                        $("#from").html(receipt.logs[0].args.sender);
                        $("#to1").html(receipt.logs[0].args.accountA);
                        $("#to2").html(receipt.logs[0].args.accountB);
                        $("#logSplitValue").html(receipt.logs[0].args.value.toString(10));
                    }else{
                        $("#from").html("NA");
                        $("#to1").html("NA");
                        $("#to2").html("NA");
                        $("#logSplitValue").html("NA");
                    }
                }
            }       
        )
    }catch (e){
        let errorString = e.toString();
        if (errorString.includes("invalid address")){
            errorString = "Tx not created. Please check input addresses.";
        }
        $("#splitStatus").html(errorString);
        console.error(e);
    }
};

const balanceCheck = async() => {
    let deployed = await Splitter.deployed();
    let amount = await deployed.balances.call($("select[id='checkBal']").val());
    $("#balance").html(amount.toString(10));
}

const withdrawingAction = async() =>{
    const gas = 300000; 
    let txId;
    // We simulate the real call and see whether this is likely to work.
    try{
        let deployed = await Splitter.deployed();
        let simResult = await deployed.withdrawal.call(
            {
            from: $("select[id='withdrawingAddr']").val(),
            gas:gas
            });
        
        if (await !simResult) {
            throw new Error("The transaction will fail anyway, not sending");
        }
        // Ok, we move onto the proper action.
        await deployed.withdrawal(
            {
            from: $("select[id='withdrawingAddr']").val(),
            gas:gas
            }
        )
        .on(
            "transactionHash",
            txHash => {
                txId = txHash;
                $("#withdrawStatus").html("Created Transaction: " + txHash);
            }
        )
        .on(
            "receipt", receipt =>{
                if (!receipt.status) {
                    console.error("Wrong status");
                    console.error(receipt);
                    $("#withdrawStatus").html("There was an error in the tx execution, status not 1");
                    $("#withdrawer").html("NA");
                    $("#withdrawValue").html("NA");
                } else if (receipt.logs.length == 0) {
                    console.error("Empty logs");
                    console.error(receipt);
                    $("#withdrawStatus").html("There was an error in the tx execution, missing expected event");
                    $("#withdrawer").html("NA");
                    $("#withdrawValue").html("NA");
                } else {
                    console.log(receipt.logs[0]);
                    $("#withdrawStatus").html("Withdrawal executed. Tx ID: " + txId);
                    if (receipt.logs[0].event == "LogWithdrawal"){
                        $("#withdrawer").html(receipt.logs[0].args.account);
                        $("#withdrawValue").html(receipt.logs[0].args.value.toString(10));
                    }else{
                        $("#withdrawer").html("NA");
                        $("#withdrawValue").html("NA");
                    }
                }
            }       
        )
    }catch (e){
        let errorString = e.toString();
        if (errorString.includes("invalid address")){
            errorString = "Tx not created. Please check input address.";
        }
        $("#withdrawStatus").html(errorString);
        console.error(e);
    }
};


window.addEventListener('load', async() => {
    let accountsList;
    
    accountsList = await web3.eth.getAccounts()            
    if (accountsList.length == 0) {
        throw new Error("No account with which to transact");
    }
    let network = await web3.eth.net.getId();
    console.log("Network:", network.toString(10));
    await Splitter.deployed();
    await Promise.all([
        populator("alice", accountsList),
        populator("bob", accountsList),
        populator("carol", accountsList),
        populator("checkBal", accountsList),
        populator("withdrawingAddr", accountsList),
        $("#Split").click(splitAction),
        $("#Check").click(balanceCheck),
        $("#Withdraw").click(withdrawingAction)
    ]).catch(console.error);
});

let populator = function(elId, list){
    let selector = this.document.getElementById(elId);

    for(let i = 0; i < list.length; i++) {
        let el = document.createElement("option");
        el.textContent = list[i];
        el.value = list[i];
        selector.appendChild(el);
    }
}


require("file-loader?name=../index.html!../index.html");
