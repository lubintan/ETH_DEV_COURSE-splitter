pragma solidity 0.5.10;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/lifecycle/Pausable.sol';
//version: openzeppelin-solidity@2.3.0 
//functions: isPauser(address), addPauser(address), renouncePauser(), pause(), unpause(), paused()

contract Splitter is Pausable{
    mapping (address => uint256) public balances;

	event LogSplit(address indexed sender, address indexed accountA, address indexed accountB, uint256 value);
	event LogWithdrawal(address indexed account, uint256 indexed value);

	using SafeMath for uint256;
	//add, sub, mul, div, mod

	constructor()
		public
	{}

	function killAndWithdraw()
		public
		onlyPauser
		whenPaused
		//Pausing can only be done by owner, unless owner has given pausing rights to another address.
		//This function requires the contract to first be paused, acting as an extra level of confirmation since
		//this irreversibly selfdestructs the contract.
	{
		selfdestruct(msg.sender);
	}

	function split(address bob, address carol)
		public
		payable
		whenNotPaused
		returns (bool success)
	{
		require(msg.value > 0, "Cannot split 0 value input.");
		require(bob != address(0), "Receiver 1 address empty.");
		require(carol != address(0), "Receiver 2 address empty.");

		uint256 splitAmount = msg.value.div(2);
		balances[bob] = balances[bob].add(splitAmount);
		balances[carol] = balances[carol].add(splitAmount);

		// if amount is odd, return extra 1 to sender.
		uint256 remainder = msg.value%2;
		if (remainder > 0){
			balances[msg.sender] = balances[msg.sender].add(remainder);
		}

		emit LogSplit(msg.sender, bob, carol, msg.value);

		return true;
	}

	function withdrawal()
		public
		whenNotPaused
    {
		uint256 withdrawalAmount = balances[msg.sender];
		require(withdrawalAmount > 0, "Withdrawal amount cannot be 0.");
		balances[msg.sender] = 0;
		emit LogWithdrawal(msg.sender, withdrawalAmount);
		msg.sender.transfer(withdrawalAmount);
	}

	function ()
		external
	{
		revert();
	}

}
